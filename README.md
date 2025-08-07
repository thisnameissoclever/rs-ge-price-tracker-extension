# RuneScape Grand Exchange Price Tracker

A Chrome extension that allows you to track RuneScape Grand Exchange item prices and set price alerts.

## Features

- **Item Tracking**: Add items to your watchlist directly from RuneScape Grand Exchange item pages
- **Price Alerts**: Set high and low price thresholds to receive notifications when prices cross them
- **Real-time Monitoring**: Automatic price checking every 5 minutes (configurable)
- **Easy Management**: Simple popup interface to view and manage your tracked items

## How to Use

### Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your browser toolbar

### Adding Items to Track

**Method 1: From Item Pages**
1. Visit any RuneScape Grand Exchange item page (e.g., `https://secure.runescape.com/m=itemdb_rs/Elder+logs/viewitem?obj=29556`)
2. A "📈 Track this item" button will appear in the top-right corner
3. Click the button to add the item to your watchlist

**Method 2: From Extension Popup**
1. While on a RuneScape item page, click the extension icon
2. Click "Add to Watchlist" in the popup

### Managing Your Watchlist

1. Click the extension icon to open the popup
2. View all your tracked items with current prices
3. Set price alerts by entering values in the "Low Alert" and "High Alert" fields
4. Click "Update Alerts" to save your thresholds
5. Click the "×" button to remove items from your watchlist

### Price Alerts

- **Low Alert**: Get notified when the price drops to or below this value
- **High Alert**: Get notified when the price rises to or above this value
- Notifications will appear as desktop notifications when price thresholds are crossed

## Technical Details

### Files Structure

- `manifest.json` - Extension configuration
- `src/background.js` - Background service worker for price checking and notifications
- `src/content.js` - Content script that runs on RuneScape item pages
- `src/popup/popup.html` - Extension popup interface
- `src/popup/popup.js` - Popup functionality
- `icon*.png` - Extension icons

### Permissions

The extension requires the following permissions:
- `activeTab` - To interact with the current tab
- `storage` - To save your watchlist and settings
- `notifications` - To show price alert notifications
- `alarms` - To schedule periodic price checks
- `https://secure.runescape.com/*` - To access RuneScape Grand Exchange pages

### Data Storage

- All data is stored locally using Chrome's storage API
- No data is sent to external servers
- Your watchlist persists between browser sessions

## Current Limitations

- **Price Fetching**: The current implementation includes placeholder code for price fetching. To make it fully functional, you would need to implement one of these approaches:
  - Use RuneScape's official API (if available)
  - Implement web scraping of item pages
  - Use a third-party RuneScape price API
  - Parse price data from the item pages directly

- **Price Update Frequency**: Currently set to check every 5 minutes, but actual price updates depend on the implementation of the price fetching mechanism

## Development

### To modify the extension:

1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh button on your extension
4. Test your changes

### Key Functions

- `addItemToWatchlist()` - Adds items to the tracking list
- `checkPricesAndAlert()` - Periodic price checking and alert logic
- `extractItemData()` - Extracts item information from RS pages
- `sendNotification()` - Shows desktop notifications for price alerts

## Contributing

Feel free to contribute improvements, especially:
- Better price fetching implementation
- Enhanced item data extraction
- UI/UX improvements
- Additional alert types

## License

This project is open source. Feel free to modify and distribute as needed.

## Disclaimer

This extension is not affiliated with Jagex or RuneScape. Use at your own risk. Always verify prices on the official RuneScape website before making trading decisions.

1. Clone the repository or download the project files.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click on "Load unpacked" and select the `chrome-extension-project` directory.

## Usage

Once the extension is loaded, you can interact with it through the popup interface. The background script will manage the extension's lifecycle and handle any necessary events.

## Contributing

Feel free to submit issues or pull requests if you have suggestions or improvements for the project.