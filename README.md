# RuneScape Grand Exchange Price Tracker

A powerful Chrome extension that allows you to track RuneScape Grand Exchange item prices in real-time and receive notifications when prices hit your target thresholds. Never miss a profitable trade opportunity again!

## 🌟 Features

- **📊 Real-time Price Tracking**: Automatically fetches live prices from the official RuneScape Grand Exchange
- **🔔 Smart Price Alerts**: Set high and low price thresholds with desktop notifications
- **⏰ Background Monitoring**: Continuous price checking every 1-60 minutes (configurable)
- **🎯 Easy Item Management**: Add items directly from RS item pages or through the popup
- **⚙️ Comprehensive Settings**: Customize update intervals, notifications, display options, and more (v1.0.1: ALL SETTINGS NOW FUNCTIONAL!)
- **💾 Local Storage**: All data stored securely on your device - no external servers
- **🖥️ Compact View**: Space-efficient layout option to view more items at once
- **🎨 RuneScape-themed UI**: Authentic game-inspired design with alert animations
- **💰 Flexible Price Formats**: Display prices as full GP, abbreviated (k/m), or auto-format (v1.0.1)
- **📋 Advanced Sorting**: Sort watchlist by alerts, name, price, or date added (v1.0.1)
- **🔇 Sound Control**: Toggle notification sounds on/off (v1.0.1)
- **🗑️ Auto-Remove**: Automatically remove items after alerts trigger (v1.0.1)

## 🚀 Installation

### From Chrome Web Store (Recommended)

1. **Visit the Chrome Web Store**
   - Go to: **[https://pricetracker.snc.guru](https://pricetracker.snc.guru)**
   - Or directly: [Chrome Web Store](https://chromewebstore.google.com/detail/rs-grand-exchange-price-t/hcppnjbjiopcefeebfllhhkfndicgocn)

2. **Install the Extension**
   - Click **"Add to Chrome"**
   - Click **"Add Extension"** when prompted
   - The extension icon will appear in your browser toolbar

3. **Grant Permissions**
   - Click "Allow" when prompted for permissions
   - The extension needs access to RuneScape pages and notification permissions

### From Source (Developer Installation)

1. **Download the Extension**
   ```bash
   git clone https://github.com/thisnameissoclever/rs-ge-price-tracker-extension.git
   cd rs-ge-price-tracker-extension
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **"Developer mode"** in the top-right corner
   - Click **"Load unpacked"**
   - Select the `chrome-extension-project` directory
   - The extension icon should appear in your browser toolbar

3. **Grant Permissions**
   - Click "Allow" when prompted for permissions
   - The extension needs access to RuneScape pages and notification permissions

## 📖 Detailed Usage Guide

### Adding Items to Your Watchlist

#### Method 1: From RuneScape Item Pages (Recommended)

1. **Navigate to any RuneScape Grand Exchange item page**
   
   Example: Visit [Elder Logs](https://secure.runescape.com/m=itemdb_rs/Elder+logs/viewitem?obj=29556)
   ```
   https://secure.runescape.com/m=itemdb_rs/Elder+logs/viewitem?obj=29556
   ```

2. **Look for the "Track this item" button**
   - A blue **"📈 Track this item"** button will appear in the top-right corner of the page
   - If you don't see it, make sure the page has fully loaded

3. **Add to watchlist**
   - Click the **"📈 Track this item"** button
   - You'll see a confirmation that the item was added
   - The item will immediately appear in your watchlist with current price data

#### Method 2: Via Extension Popup

1. **While on a RuneScape item page**, click the extension icon in your toolbar
2. **In the popup**, you'll see current item information displayed
3. **Click "Add to Watchlist"** to track the item

### Managing Your Watchlist

#### Opening the Watchlist

- **Click the extension icon** in your browser toolbar
- The popup will show all your tracked items with current prices and alert status

#### Setting Price Alerts

For each tracked item (using Elder Logs as an example):

1. **Low Alert Threshold**
   - Enter a value in the **"Low Alert (≤)"** field
   - Example: Enter `9000` to get notified when Elder Logs drop to 9,000 gp or below
   - Useful for: Buying opportunities, detecting market crashes

2. **High Alert Threshold**  
   - Enter a value in the **"High Alert (≥)"** field
   - Example: Enter `12000` to get notified when Elder Logs rise to 12,000 gp or above
   - Useful for: Selling opportunities, profit taking

3. **Save Your Alerts**
   - Click the **"Update Alerts"** button next to each item
   - Your thresholds will be saved and monitored continuously

#### Managing Items

- **Remove Items**: Click the **"×"** button to remove an item from your watchlist
- **View Details**: Click the item name to visit its Grand Exchange page
- **Sort Items**: Items with active alerts automatically appear at the top

### Understanding Price Alerts

#### Alert Types

- **🔻 LOW Alert** (Red): Triggered when price drops to or below your low threshold
- **🔺 HIGH Alert** (Green): Triggered when price rises to or above your high threshold

#### Example Alert Scenarios

**Elder Logs Example** (Current price: 10,223 gp):
- **Set Low Alert**: 9,500 gp → Get notified if price drops to 9,500 gp or lower
- **Set High Alert**: 11,000 gp → Get notified if price rises to 11,000 gp or higher
- **Both Alerts**: Monitor for both buying (low) and selling (high) opportunities

#### Notification Behavior

- **Desktop Notifications**: Pop-up notifications appear when alerts trigger
- **Visual Indicators**: Items with active alerts are highlighted in the popup
- **Alert Animations**: Pulsing effects draw attention to triggered alerts
- **Notification Limits**: Configurable to prevent spam (default: 10 per hour)

### Accessing Settings

1. **Open the extension popup**
2. **Click the "⚙️ Settings" button** in the top-right corner
3. **The settings page opens in a new tab** with comprehensive options

### Key Settings Options

#### Price Update Settings
- **Update Interval**: 1-60 minutes (default: 5 minutes)
- **Auto-refresh**: Refresh prices when opening popup
- **Background Updates**: Continue monitoring when browser is minimized

#### Notification Settings
- **Desktop Notifications**: Enable/disable alert notifications
- **Sound Alerts**: Play sound when alerts trigger
- **Alert Duration**: How long notifications stay visible
- **Notification Limit**: Maximum alerts per hour

#### Display Settings
- **Price Format**: Show as "10,223 gp", "10.2k", "0.01m", or auto-format (FULLY FUNCTIONAL)
- **Sort Order**: By alerts-first, name A-Z/Z-A, price high/low, or date added (FULLY FUNCTIONAL)
- **Compact View**: Condensed layout to show more items
- **Show Price History**: Display trend information (when available)

#### Advanced Features
- **Auto-Remove**: Automatically remove items from watchlist after alert triggers (NEW)
- **Notification Rate Limiting**: Control maximum notifications per hour (1-50) (ENHANCED)
- **Notification Duration**: Set how long alerts stay visible (1-30 seconds or persistent) (ENHANCED)
- **Alert Threshold**: Percentage change required to trigger automatic price change notifications (1-50%, default 10%) (v1.0.1)
  - *This controls when you get notified about significant price movements, even without setting specific thresholds*
  - *Example: If set to 15%, you'll get alerts when any item's price changes by 15% or more since last check*

#### Data Management
- **Export Data**: Download your watchlist and settings as JSON
- **Import Data**: Restore from previously exported data
- **Reset Settings**: Return all settings to defaults

## 🔧 Technical Details

### Architecture

- **Background Service Worker** (`src/background.js`): Handles price fetching, alerts, and scheduling
- **Content Script** (`src/content.js`): Adds tracking buttons to RuneScape pages
- **Popup Interface** (`src/popup/popup.html`, `src/popup/popup.js`): Main user interface
- **Settings Page** (`src/settings/settings.html`, `src/settings/settings.js`): Configuration interface

### Price Fetching Technology

The extension uses advanced web scraping techniques to extract real-time prices:

1. **Primary Method**: Parses JavaScript `average30.push()` arrays containing current pricing data
2. **Fallback Method**: Analyzes script content for price-range numbers (1k - 10B gp)  
3. **Text Parsing**: Extracts "Current Guide Price" with K/M/B multiplier support
4. **Error Handling**: Robust fallback systems ensure reliable data extraction

### Data Storage

- **Local Storage**: Chrome's `storage.local` API for watchlist data
- **Sync Storage**: Chrome's `storage.sync` API for settings (syncs across devices)
- **No External Servers**: All data remains on your device
- **Persistent**: Data survives browser restarts and updates

### Permissions Explained

- `activeTab`: Read content from the current RuneScape tab
- `storage`: Save watchlist and settings data locally
- `notifications`: Show desktop price alert notifications  
- `alarms`: Schedule background price checks
- `https://secure.runescape.com/*`: Access official RuneScape Grand Exchange pages

### Performance

- **Efficient Scheduling**: Uses Chrome's alarm API for precise timing
- **Smart Caching**: Avoids unnecessary requests with intelligent caching
- **Rate Limiting**: Respectful request patterns to avoid server overload
- **Error Recovery**: Automatic retry logic for failed price fetches

## 🎯 Usage Examples

### Example 1: Flipping Items

**Goal**: Buy Elder Logs low, sell high

1. Add Elder Logs to watchlist from: `https://secure.runescape.com/m=itemdb_rs/Elder+logs/viewitem?obj=29556`
2. Set Low Alert: `9,800` (buying opportunity)
3. Set High Alert: `10,800` (selling opportunity)  
4. Wait for notifications and execute trades

### Example 2: Long-term Investment Monitoring

**Goal**: Track expensive items for investment timing

1. Add items like Party Hats, Rares, or high-tier equipment
2. Set alerts 5-10% below/above current prices
3. Monitor long-term trends for investment decisions

### Example 3: Resource Management

**Goal**: Buy supplies when cheap for skilling

1. Add skilling supplies (logs, ores, herbs)
2. Set low alerts for bulk buying opportunities
3. Stock up when prices dip below your threshold

## 🔄 Changelog

### Version 1.0.1 (Latest)
- **✨ NEW**: Full settings integration - all settings are now functional!
- **💰 ENHANCED**: Price format settings now work throughout the extension (gp, k, m, auto)
- **🔔 ENHANCED**: Notification duration control (1-30 seconds or persistent until dismissed)
- **🚨 ENHANCED**: Notification rate limiting (1-50 notifications per hour)
- **🔇 NEW**: Sound alert toggle - control notification sounds on/off
- **📋 NEW**: Watchlist sort options fully implemented (6 different sorting methods)
- **🗑️ NEW**: Auto-remove functionality - automatically remove items after alert triggers
- **⚡ IMPROVED**: Better async/await handling for smoother performance
- **🐛 FIXED**: All previously unwired settings are now fully functional
- **📝 ENHANCED**: Improved logging for better debugging and monitoring

### Version 1.0.0 (Chrome Web Store Release)
- **🎉 PUBLISHED**: Now available on Chrome Web Store at [pricetracker.snc.guru](https://pricetracker.snc.guru)
- **NEW**: Comprehensive settings page with 20+ configuration options
- **NEW**: Compact view mode for space-efficient item display
- **NEW**: Data export/import functionality
- **NEW**: Configurable update intervals (1-60 minutes)
- **NEW**: Advanced notification controls with limits and duration settings
- **NEW**: Multiple price display formats (gp, k, m, auto)
- **NEW**: Sort options for watchlist items
- **NEW**: Real-time price fetching from official RuneScape pages
- **NEW**: Background price monitoring with Chrome alarms
- **NEW**: Desktop notifications for price alerts
- **NEW**: Visual alert indicators in popup interface
- **FEATURE**: Enhanced price fetching with multiple fallback methods
- **FEATURE**: Better error handling and retry logic
- **FEATURE**: Responsive UI with RuneScape-themed design
- **FEATURE**: Settings persist and sync across sessions
- **FEATURE**: Alert colors (red for low, green for high)
- **FEATURE**: Complete watchlist functionality with item management

## 🛠️ Development

### Setup for Development

```bash
# Clone the repository
git clone https://github.com/thisnameissoclever/rs-ge-price-tracker-extension.git
cd rs-ge-price-tracker-extension

# Make changes to source files
# Test by reloading extension in chrome://extensions/
```

### Key Development Files

- `manifest.json` - Extension configuration and permissions
- `src/background.js` - Background service worker (price fetching, alerts)
- `src/content.js` - Content script for RuneScape pages
- `src/popup/popup.html` - Main popup interface HTML
- `src/popup/popup.js` - Popup functionality and UI logic
- `src/settings/settings.html` - Settings page interface
- `src/settings/settings.js` - Settings management and storage

### Testing

1. **Load extension** in Chrome developer mode
2. **Visit test URL**: `https://secure.runescape.com/m=itemdb_rs/Elder+logs/viewitem?obj=29556`
3. **Verify "Track this item" button** appears
4. **Test adding items** and setting alerts
5. **Check background updates** by monitoring console logs
6. **Test notifications** by setting low thresholds

## ⚠️ Important Notes

### Browser Compatibility
- **Chrome/Chromium**: Fully supported
- **Edge**: Should work (Chromium-based)
- **Firefox**: Not supported (uses different extension APIs)

### RuneScape Compatibility
- **Official RS Website**: Fully supported
- **Third-party Sites**: Not supported
- **Mobile Browser**: Limited functionality

### Rate Limiting
- Extension respects RuneScape's server resources
- Default 5-minute intervals prevent excessive requests
- Built-in error handling for network issues

## 🤝 Contributing

**📦 [Get the extension from Chrome Web Store](https://pricetracker.snc.guru)**

We welcome contributions! Here's how you can help:

### Priority Areas
- **Enhanced Price Prediction**: Trend analysis and forecasting
- **Additional Data Sources**: Integration with third-party APIs
- **Mobile Support**: Responsive design improvements
- **Performance Optimization**: Faster loading and updates
- **UI/UX Enhancements**: Better user experience

### Contribution Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License. Feel free to modify and distribute as needed.

## ⚖️ Legal Disclaimer

This extension is **not affiliated with Jagex Ltd. or RuneScape**. It is an independent tool created to enhance the player experience.

- **Use at your own risk** - Always verify prices on official RuneScape websites before making trading decisions
- **No guarantees** - Price data accuracy depends on RuneScape's website availability and structure
- **Respect game rules** - Ensure your trading activities comply with RuneScape's Terms of Service
- **Educational purpose** - This extension is created for learning and convenience purposes

## 🆘 Troubleshooting

### Common Issues

**Q: The "Track this item" button doesn't appear**
- Ensure you're on an official RuneScape Grand Exchange item page
- Check that the page URL matches: `https://secure.runescape.com/m=itemdb_rs/*/viewitem?obj=*`
- Try refreshing the page

**Q: Price updates aren't working**  
- Check your internet connection
- Verify the extension has proper permissions
- Check Chrome's developer console for error messages

**Q: Notifications not showing**
- Ensure Chrome notifications are enabled for the extension
- Check your system notification settings
- Verify notification permissions in Chrome settings:
  1. **Open Chrome Settings**: Click the three dots (⋮) → Settings
  2. **Go to Privacy and Security**: Click "Privacy and security" in the left sidebar
  3. **Site Settings**: Click "Site Settings"
  4. **Notifications**: Click "Notifications"
  5. **Check Extension Permissions**: Look for "RS Grand Exchange Price Tracker" in the "Allowed to send notifications" list
  6. **If Missing**: Go to `chrome://extensions/`, find the extension, click "Details", then "Site settings", and ensure "Notifications" is set to "Allow"
  7. **System Settings**: Also check your operating system's notification settings to ensure Chrome notifications are enabled

**Q: Settings not saving**
- Clear browser cache and reload the extension
- Check Chrome's storage permissions
- Try exporting/importing settings as backup

### Getting Help

- **GitHub Issues**: Report bugs and request features
- **Developer Console**: Check for error messages (F12 → Console)
- **Extension Settings**: Try resetting to defaults if issues persist

---

**Happy Trading!** 📈💰

*Track smarter, trade better, profit more with the RuneScape Grand Exchange Price Tracker.*