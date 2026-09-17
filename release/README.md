# Release preparation

Installers are build artifacts. Keep `.xpi` files out of Git and distribute them through GitHub Releases once the repository and release are available to the intended audience.

## Build and validate

Use Node.js 24 and a checkout containing the intended release changes:

```bash
npm ci
npm run check
npm run build:production
```

The XPI and update metadata are written to `.scaffold/build/`. CI retains the tested XPI as an Actions artifact; it does not publish a GitHub Release.

Before publishing:

- Review the version in `package.json`, the lockfile, and `docs/changelog.md`. Keep the two READMEs consistent.
- Inspect the XPI file list. Do not include `.env`, API keys, private PDFs, profiles, logs, development probes, or source maps.
- Install the XPI in a disposable Zotero profile. Check settings, connection testing, a streamed answer, formulas, selection dismissal, new conversation, and light/dark themes.
- Record the Zotero version, OS, endpoint, model, and observed result. Distinguish tested environments from compatibility targets in the README.
- Verify the project license and third-party notices before distribution.

## Repository and download links

The repository address in `package.json` is the source used by the scaffold to generate download/update URLs. Verify that it matches the actual GitHub repository and configured Git remote before release.

Create a release for `v<package version>` and attach the generated XPI using its generated filename. The current configuration points the automatic update feed to a separate `release` tag, with `update.json` (or `update-beta.json` for prereleases). Inspect the generated JSON and publish the matching feed deliberately; uploading only the versioned XPI does not establish the update feed.

Verify the release page, XPI download, and update feed from an unauthenticated session if the project is intended to be public. A successful local build does not verify any of these links. Until an installer is publicly available, the README includes source-build instructions.

Do not publish a release, change repository visibility, or enable an update feed as a side effect of ordinary documentation or CI work.
