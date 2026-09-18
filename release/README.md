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

## First time

The current tree is still `0.1.8` with no GitHub Release. After this workflow
is on `main`:

```bash
npm run release -- 0.1.8 -y
```

Use `as-is` / `0.1.8` only for that first publish. Later releases should bump.

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
