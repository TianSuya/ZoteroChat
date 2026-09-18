# Release

Installers are not stored in Git. Tag a version; GitHub Actions uploads the XPI
and the Zotero update feed.

## One-command release

On `main`, with a clean working tree:

```bash
npm run check
npm run release          # pick major / minor / patch (or 0.1.9)
```

That bumps `package.json`, runs a production build, commits, tags `v*`, and
pushes. The [Release](../.github/workflows/release.yml) workflow then:

1. Rebuilds and checks the tagged commit
2. Creates GitHub Release `v{version}` and attaches `zotero-chat.xpi`
3. Creates or updates GitHub Release `release` with `update.json`

Do not publish from an ordinary pull request. Do not put `GITHUB_TOKEN` in
`.env` unless you intentionally switch to local publishing.

## First time (version already in package.json)

Scaffold does **not** create a git tag when the chosen version equals
`package.json`. It then looks up `v{version}` for the changelog and fails with
`Tag "v0.1.8" not found`. The `release:push` hook creates and pushes that tag
if it is missing. You can also do it yourself:

```bash
git tag v0.1.8
git push origin v0.1.8
```

Later releases should bump (`npm run release`, then pick patch/minor).

## Manual fallback

If Actions cannot publish:

```bash
npm run build:production
```

Then attach `.scaffold/build/zotero-chat.xpi` to tag `v{version}` and
`.scaffold/build/update.json` to tag `release`. Filenames must match
`xpiDownloadLink` / `updateURL` in `zotero-plugin.config.ts`.

## Before you tag

- Version, lockfile, and [docs/changelog.md](../docs/changelog.md) agree
- XPI has no `.env`, API keys, private PDFs, or source maps
- Smoke-test the XPI in a disposable Zotero profile
