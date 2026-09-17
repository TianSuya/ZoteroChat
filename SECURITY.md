# Security reporting

ZoteroChat handles document text and model API credentials. Read the [data and privacy section](README.md#data-and-privacy) before configuring an endpoint.

## Reporting a concern

If the repository's **Security → Report a vulnerability** option is available, use that private channel. Its availability depends on the repository's GitHub settings.

If no private channel is available, open an issue requesting a private contact method, without exploit details, credentials, document contents, or other sensitive information. A dedicated security email and response-time commitment have not been established.

Once a private channel is available, include the affected version, environment, reproduction steps, expected impact, and a minimal example with synthetic data. Do not send a real API key or a confidential PDF.

## Version scope

The project is in early development. Fixes target the current development version; no maintenance or backport policy for older releases has been established.

## Accidental credential disclosure

Revoke or rotate a disclosed key with the provider. Removing a file from the latest Git revision does not remove it from existing clones or Git history. Do not attach raw Zotero profiles or full development logs to public reports.
