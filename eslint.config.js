import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "node_modules/**",
      ".scaffold/**",
      ".build/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "fixtures/**",
      ".claude/**",
      ".grok/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    extends: [js.configs.recommended],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
    rules: {
      // Several Zotero APIs do not yet have complete upstream typings.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["addon/bootstrap.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        APP_SHUTDOWN: "readonly",
        Components: "readonly",
        Services: "readonly",
        Zotero: "readonly",
      },
    },
    // Zotero supplies fixed lifecycle signatures, including unused arguments.
    rules: {
      "no-unused-vars": [
        "error",
        {
          args: "none",
          varsIgnorePattern:
            "^(install|startup|onMainWindowLoad|onMainWindowUnload|shutdown|uninstall)$",
        },
      ],
    },
  },
  {
    files: ["addon/prefs.js"],
    languageOptions: { globals: { pref: "readonly" } },
  },
);
