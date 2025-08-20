# Privacy Policy

Last updated: 2025-08-19

This document explains what data the “RS Grand Exchange Price Tracker” Chrome extension processes, how it uses extension permissions, what leaves your device, and the controls you have. This policy reflects the current codebase at commit e70c9f2.

## Summary
- We do not collect, sell, or share personal information.
- No analytics or tracking services are used.
- No data is sent to any server controlled by the developer.
- Network requests are only made to RuneScape’s official domain to read item pages:
  - https://secure.runescape.com/*
- Your watchlist and settings are stored using Chrome’s extension storage. Some data may sync via your Google account if Chrome Sync is enabled.

## What the extension does
The extension lets you add RuneScape Grand Exchange items to a watchlist, automatically fetches current guide prices and 30‑day history from the official item pages, and notifies you when prices cross thresholds you configure.

## Data the extension processes
The extension stores only the data needed to provide its features:

- Watchlist entries per item (stored primarily in Chrome sync storage):
  - id (item ID), name
  - url (canonical RS item URL) and originalUrl (URL you visited)
  - currentPrice
  - imageUrl (official RS item image URL)
  - lowThreshold and highThreshold
  - priceAnalysis summary (computed statistics from history)
  - timestamps such as addedAt, lastChecked, lastHistoryUpdate, lastThresholdUpdate, lastLowAlert, lastHighAlert
- Settings and preferences (update interval, notification options, display choices, etc.).
- Price history arrays (date, price, volume) for each item are stored in Chrome local storage only, under keys like `priceHistory_{itemId}`.
- Ephemeral in-memory data: a short notification history used for rate limiting within the current background session only; it is not persisted.

No keystrokes, credentials, or personal details are captured. The extension does not read or store your general browsing history.

## Where data is stored
- chrome.storage.sync (syncs across devices via your Google account):
  - Watchlist (core fields listed above)
  - Settings
- chrome.storage.local (device‑only):
  - Full price history arrays per item (larger data)

If Chrome sync storage limits are exceeded, the extension automatically falls back to chrome.storage.local for the watchlist so features keep working. When this fallback is in use, the watchlist will not sync across devices.

Uninstalling the extension removes its storage from your browser. If you use Chrome Sync, copies may persist in your Google account until Chrome processes the deletion; you can also manage synced data in your Google account settings.

## Extension permissions and how they’re used
- activeTab: Detect the current RuneScape tab to offer “Add to Watchlist” and to request item data from the content script when you open the popup.
- storage: Save your watchlist, settings, and cached price history.
- notifications: Show desktop notifications when alerts trigger.
- alarms: Schedule background price checks at the interval you configure.
- host_permissions → https://secure.runescape.com/*: Read item pages and fetch page HTML to parse current prices and history.

The content script only runs on pages that match `https://secure.runescape.com/m=itemdb_rs/*`.

## Network activity
- The extension fetches only RuneScape Grand Exchange item pages on `secure.runescape.com` to parse prices and history.
- No requests are made to third‑party analytics or developer servers.

## Data retention and user controls
- Data persists until you remove it or uninstall the extension.
- You control your data:
  - Remove individual items from the watchlist inside the popup.
  - Reset settings to defaults from the settings page (does not delete the watchlist).
  - Export and import your watchlist and settings from the settings page.
  - Uninstall the extension to delete its stored data from the browser. If you use Chrome Sync, synced copies are managed by Chrome/Google.

## Security
- All fetching uses HTTPS endpoints on `secure.runescape.com`.
- Data is stored using Chrome’s extension storage APIs. No additional encryption is applied by the extension beyond what Chrome provides.

## Children’s privacy
This extension is not directed to children. It does not knowingly collect personal information.

## Changes to this policy
We may update this policy if the extension’s behavior changes. Significant changes will be reflected by updating this file in the repository and bumping the “Last updated” date above.

## Contact
For privacy questions or issues, contact: myemailaddressisveryclever@gmail.com
