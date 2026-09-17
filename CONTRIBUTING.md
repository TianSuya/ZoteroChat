# Contributing to ZoteroChat

English and Chinese contributions are welcome. For substantial changes, open an issue describing the user problem and proposed scope before implementation.

## Development setup

Use Node.js 24 (also specified in `.nvmrc`) and npm:

```bash
npm ci
```

For interactive development, copy `.env.example` to `.env`, configure your Zotero executable, and use separate, disposable profile and data directories. Run `npm start` after configuration. Never point the development server at your everyday Zotero library.

Building and unit testing do not require Zotero or an API key. Zotero runtime validation does. See [the development guide](docs/development.md) for setup and probes; design notes are currently in Chinese.

## Before opening a pull request

```bash
npm run check
npm run build:production
```

`check` runs ESLint, Prettier, TypeScript, and Vitest. Use `npm run format` for formatting and `npm run lint:fix` for available lint fixes. Review the resulting diff before committing. CI runs the same checks and builds an XPI; it does not validate a running Zotero instance or make model requests.

For UI or integration changes, record the Zotero version, OS, theme, reproduction steps, and observed result. Attach focused screenshots when the appearance changes. Test switching PDFs and opening/closing the sidebar when changing session or panel lifecycle behavior.

## Design constraints

- Keep the frozen paper prefix stable. Dynamic language and selection state belong to the current turn.
- Append completed turns; do not rewrite committed history to implement edits or retries.
- Keep Zotero APIs and API credentials on the plugin side of the typed bridge.
- Keep React UI in the panel iframe. Do not move an existing iframe between parents.
- Follow the XHTML rendering rules for Markdown and MathML; do not inject via `innerHTML`.
- Update both READMEs when changing public behavior. Update relevant docs and add an [ADR](docs/adr/README.md) for architectural decisions.

## Git and review

Keep each pull request focused on one problem. Separate formatting-only changes from behavior changes where practical. Follow the repository's existing Chinese commit-message convention: explain why the change is needed, and include runtime evidence for integration fixes. PR descriptions may be in English or Chinese.

Commit the lockfile when changing dependencies. Do not commit API keys, `.env`, Zotero profiles, private PDFs, logs, `node_modules`, or build output. Installers belong in GitHub Releases, not Git history. `.env.example` must contain placeholders only.

Use the bug report or feature request template. Include a minimal reproducible example, and remove credentials and private paper content from logs and screenshots. See [SECURITY.md](SECURITY.md) for security reports.

## Release changes

Follow [release/README.md](release/README.md). Publishing, release tagging, and update-feed changes are maintainer actions; a normal PR must not publish artifacts automatically.
