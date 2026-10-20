pref("__prefsPrefix__.apiBaseUrl", "https://api.deepseek.com");
pref("__prefsPrefix__.apiKey", "");
pref("__prefsPrefix__.model", "deepseek-flash");
pref("__prefsPrefix__.replyLanguage", "zh-CN");
pref("__prefsPrefix__.fontSize", 14);
pref("__prefsPrefix__.followZoteroTheme", true);
pref("__prefsPrefix__.showSelectionPopupButtons", true);
pref("__prefsPrefix__.translateEngine", "google");
pref("__prefsPrefix__.translateDeeplKey", "");
pref("__prefsPrefix__.translateGoogleCloudKey", "");
pref("__prefsPrefix__.translateAzureKey", "");
pref("__prefsPrefix__.translateAzureRegion", "global");
pref("__prefsPrefix__.translateFontSize", 14);
pref("__prefsPrefix__.translatePopupWidth", 280);
pref("__prefsPrefix__.translatePopupHeight", 96);
pref("__prefsPrefix__.showCostBar", true);
pref("__prefsPrefix__.debugDumpPayload", false);

// DeepSeek Search / Fetch tools. The search key may be empty, in which case
// the main API key is used. Search and Fetch are billed per successful request.
pref("__prefsPrefix__.searchEnabled", true);
pref("__prefsPrefix__.searchApiKey", "");
pref("__prefsPrefix__.searchBaseUrl", "https://api.deepseek.com");
// Allow the assistant to download a paper after an explicit confirmation.
pref("__prefsPrefix__.allowPaperDownloads", true);

// Development fixture: absolute path to a PDF imported into an empty dev library.
pref("__prefsPrefix__.devSeedPDF", "");
// Development only: gitignored file holding the API key. Not a user pref.
pref("__prefsPrefix__.devApiKeyFile", "");

// Dev-only: render the Radix-in-iframe probe inside the panel.
pref("__prefsPrefix__.devShowRadixProbe", false);
// Dev-only: render the assistant-ui runtime probe inside the panel.
pref("__prefsPrefix__.devShowAssistantProbe", false);
