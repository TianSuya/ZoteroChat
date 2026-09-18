import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import autoprefixer from "autoprefixer";
import type { Plugin } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { defineConfig } from "zotero-plugin-scaffold";

import pkg from "./package.json";

/** Plugin Manager homepage and update feed. Keep in sync with package.json. */
const GITHUB_REPO = "TianSuya/ZoteroChat";
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

const TAILWIND_ENTRY = resolve("src/ui/styles/tailwind.css");
const VIRTUAL_ID = "virtual:panel-css";

/**
 * Compiles the Tailwind entry and hands it to the bundle as a JS string.
 *
 * The panel lives in an iframe, so its stylesheet is installed at runtime
 * via a style element rather than linked from a file. Shipping the CSS as
 * a string means no file IO and no chrome:// URL resolution at runtime.
 */
function tailwindAsString(): Plugin {
  return {
    name: "zc-tailwind-as-string",
    setup(build) {
      build.onResolve({ filter: /^virtual:panel-css$/ }, () => ({
        path: VIRTUAL_ID,
        namespace: "zc-virtual",
      }));

      build.onLoad({ filter: /.*/, namespace: "zc-virtual" }, async () => {
        const source = readFileSync(TAILWIND_ENTRY, "utf8");
        const result = await postcss([
          tailwindcss(),
          autoprefixer({ overrideBrowserslist: ["Firefox >= 115"] }),
        ]).process(source, { from: TAILWIND_ENTRY });

        return {
          contents: `export default ${JSON.stringify(result.css)};`,
          loader: "js",
          // Re-run when the entry or the Tailwind config changes. Class-name
          // scanning still needs a full rebuild, which the scaffold watcher
          // triggers on any `src` change.
          watchFiles: [TAILWIND_ENTRY, resolve("tailwind.config.js")],
        };
      });
    },
  };
}

const isProd = process.env.NODE_ENV === "production";

const sharedDefine = {
  "process.env.NODE_ENV": isProd ? '"production"' : '"development"',
  __env__: `"${process.env.NODE_ENV ?? "development"}"`,
};

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `${GITHUB_URL}/releases/download/release/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiDownloadLink: `${GITHUB_URL}/releases/download/v{{version}}/{{xpiName}}.xpi`,

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author ?? "",
      description: pkg.description,
      homepage: pkg.homepage || GITHUB_URL,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      // Plugin side: runs in the bootstrap sandbox. No React, no DOM.
      {
        entryPoints: ["src/index.ts"],
        bundle: true,
        // Zotero 7 runs on Firefox 115 ESR; 8 and 9 run on 140. Target the
        // floor so one bundle serves all three.
        target: "firefox115",
        format: "iife",
        define: sharedDefine,
        minify: isProd,
        sourcemap: isProd ? false : "inline",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
      // Panel side: runs in panel.xhtml inside the item pane iframe, which is
      // a real HTML document — the reason React and Radix work at all here.
      {
        entryPoints: ["src/panel-app/index.tsx"],
        bundle: true,
        target: "firefox115",
        format: "iife",
        jsx: "automatic",
        plugins: [tailwindAsString()],
        define: sharedDefine,
        minify: isProd,
        sourcemap: isProd ? false : "inline",
        outfile: ".scaffold/build/addon/content/scripts/panel.js",
      },
      // Preferences pane: a real DOM document inside Zotero Settings.
      {
        entryPoints: ["src/prefs/pane.ts"],
        bundle: true,
        target: "firefox115",
        format: "iife",
        define: sharedDefine,
        minify: isProd,
        sourcemap: isProd ? false : "inline",
        outfile: ".scaffold/build/addon/content/scripts/preferences.js",
      },
    ],
  },

  server: {
    devtools: true,
    // `--jsdebugger` opens the Browser Toolbox; enable it when you need it.
    startArgs: [],
    prefs: {
      // Seeds the throwaway dev library so the reader has something to open.
      [`${pkg.config.prefsPrefix}.devSeedPDF`]: resolve(
        "fixtures/attention.pdf",
      ),
      [`${pkg.config.prefsPrefix}.devApiKeyFile`]: resolve("deepseek.key"),
    },
  },

  release: {
    bumpp: {
      execute: "npm run build:production",
    },
    github: {
      enable: "ci",
      repository: GITHUB_REPO,
      updater: "release",
    },
  },

  test: {
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
  },
});
