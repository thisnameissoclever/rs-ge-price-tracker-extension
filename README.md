# RuneScape Grand Exchange Price Tracker

Make more gp with data you can act on. This Chrome extension tracks RS3 Grand Exchange prices, highlights buy/sell opportunities, and alerts you at the right moment. Full formatted docs: https://rs-ge-readme.snc.guru

## 🌟 Why this helps you make gp

- Smart alerts: set buy/sell thresholds and get desktop notifications when prices cross them.
- Actionable market insights: 30-day history, trend direction, volatility, and position-in-range.
- Better signals (v1.6.0): accurate volatility categorization and real-time price analysis with configurable chart periods.
- Works in the background: scheduled checks you control; pop-out tab with a clean column layout for fast scanning.
- One-click add from RS3 GE pages; item images for quick scanning. Sync across devices; export/import for backups.

## 🚀 Install

### Chrome Web Store (recommended)
- https://pricetracker.snc.guru → Add to Chrome → Allow permissions

### From source (devs)
1) git clone https://github.com/thisnameissoclever/rs-ge-price-tracker-extension.git
2) Open chrome://extensions → Enable Developer mode → Load unpacked → select chrome-extension-project

## 📖 Quick start

1) Add items from any RS3 GE page ("📈 Track this item") or via the popup
2) Set Low/High thresholds per item; press Enter or click Update Alerts
3) Watch the signals: tooltips show position-in-range, z-score, and percentile for buy/sell context

Tip: For sync reliability, keep watchlists to ~80–90 items (100–200 max).

## 🧠 How trading signals work (v1.6.0)

- Z-score: how far current price is from the 30-day average (in standard deviations)
- Percentile rank: where today’s price sits vs the last 30 days (0–100%)
- Range position: 0 = near 30-day low, 1 = near 30-day high
- Combined scoring: these signals are weighted to surface likely buys near lows and sells near highs

## 🔄 Changelog

### 🚀 Version 1.6.0 (Latest)
- **Accurate volatility analysis**: Fixed volatility thresholds for RuneScape markets - Low (0-3%), Moderate (3-8%), High (>8%)
- **Real-time price analysis**: Popup always uses fresh price data instead of stale cached analysis
- **Configurable chart history**: Choose 7, 14, 30, 60, or 90 days for price charts (default: 30 days)
- **Improved trading signals**: Better buy/sell recommendations based on current market position vs range

### 🔧 Version 1.5.2
- Smarter trading hints: multi-signal scoring (z-score, percentile, 30-day range position)
- Pop-out tab uses a clean, columnar layout like Settings for faster scanning
- README cleanup focused on profit-driving features; updated docs; clear privacy policy

### 🔧 Version 1.5.1
- Fixed image URL sync issues; unified URL format and improved validation
- Added extensive logging and resolved a race condition in image updates

### 🎯 Version 1.5.0
- Interactive sparkline charts with rich tooltips and early trading signals
- Pop-out button to work in a full tab; stability and volatility metrics

## 🔒 Privacy

No external servers or telemetry. Data stays in Chrome storage (sync/local). Details: see PRIVACY.md.

## ⚖️ Disclaimer

Not affiliated with Jagex or RuneScape. Use at your own risk; always verify prices on official sources.

## 📄 License

MIT
