# RS Grand Exchange Price Tracker Chrome Extension

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

This is a Chrome extension (manifest v3) that tracks RuneScape Grand Exchange item prices and sends desktop notifications when price thresholds are reached. The extension requires no build process - all files are used directly by Chrome.

## Working Effectively

### Bootstrap and Validate the Extension
**NEVER CANCEL** - Complete all steps in sequence. Validation typically takes under 5 minutes total.

1. **Validate JavaScript syntax** (takes ~0.2s per file):
   ```bash
   node -c src/background.js
   node -c src/content.js  
   node -c src/popup/popup.js
   node -c src/settings/settings.js
   ```

2. **Validate JSON configuration** (takes ~0.1s):
   ```bash
   python3 -c "import json; json.load(open('manifest.json')); print('manifest.json is valid')"
   ```

3. **Install and run ESLint for code quality** (install takes ~2s, linting takes ~0.5s):
   ```bash
   npm install --no-package-lock --no-save eslint
   echo 'export default [{ rules: {} }];' > eslint.config.js
   ./node_modules/.bin/eslint src/*.js src/**/*.js
   ```

4. **Test extension loading in Chrome** (takes ~0.5s):
   ```bash
   timeout 15s google-chrome --no-sandbox --disable-gpu --headless --dump-dom --load-extension=. about:blank > /tmp/extension_test.html
   ```
   Extension loads successfully if `/tmp/extension_test.html` contains `<html>` tags.

### Testing the Extension Manually
**CRITICAL**: After making any code changes, ALWAYS test the complete extension functionality manually:

1. **Load the extension in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode" 
   - Click "Load unpacked" and select the extension root directory
   - Extension icon should appear in Chrome toolbar

2. **Test extension popup functionality**:
   - Click the extension icon
   - Popup should open with watchlist interface
   - Test adding/removing items, setting thresholds
   - Verify no console errors in popup DevTools

3. **Test RuneScape integration**:
   - Navigate to https://secure.runescape.com/m=itemdb_rs/
   - Search for any item (e.g., "Dragon scimitar")
   - On item page, extension should show "📈 Track this item" button
   - Click button to add item to watchlist

4. **Test notification system** (requires patience - background checks run every 5 minutes):
   - Set low/high price thresholds for tracked items
   - Wait for background price check cycle OR
   - Use popup "Refresh Prices" button to trigger immediate check
   - If prices cross thresholds, persistent notifications should appear
   - Badge count on extension icon should show alert count

### Manual Validation Scenarios
**Always run at least one complete scenario after making changes**:

#### Scenario 1: Add Item and Set Alert
1. Visit RuneScape GE item page  
2. Click "Track this item" from extension
3. Set price thresholds in popup
4. Verify item appears in watchlist
5. Test threshold alerts (may require waiting or manual price refresh)

#### Scenario 2: Settings and Data Management  
1. Open extension popup → Settings
2. Modify update intervals, notification preferences
3. Test export/import functionality with watchlist data
4. Verify settings persist after browser restart

## Common Commands and Timing

### Validation Commands (run frequently)
```bash
# Complete validation suite - NEVER CANCEL - takes ~5 minutes total:
node -c src/*.js src/**/*.js                    # ~0.8s total
npm install --no-package-lock --no-save eslint  # ~2s (if not installed)
./node_modules/.bin/eslint src/*.js src/**/*.js # ~0.5s
timeout 15s google-chrome --no-sandbox --disable-gpu --headless --dump-dom --load-extension=. about:blank  # ~0.5s
```

### Development Workflow
```bash
# After making changes, always run:
node -c src/background.js                    # Validate syntax
google-chrome --load-extension=.             # Test in browser (manual)
# Then perform manual testing scenarios
```

### Debugging Extension Issues
- **Background script logs**: Chrome Extensions → RS GE Price Tracker → Service Worker → Console
- **Popup logs**: Right-click extension icon → Inspect popup → Console tab  
- **Content script logs**: Open RuneScape GE page → F12 DevTools → Console tab
- **Extension loading errors**: chrome://extensions/ → Click "Errors" button

## File Structure and Key Locations

```
rs-ge-price-tracker-extension/
├── manifest.json              # Extension configuration (manifest v3)
├── src/
│   ├── background.js          # Service worker - handles alarms, notifications, price fetching
│   ├── content.js             # Runs on RuneScape GE pages - adds "Track item" button
│   ├── popup/
│   │   ├── popup.html         # Main extension popup UI
│   │   └── popup.js           # Popup logic - watchlist display, item management
│   └── settings/
│       ├── settings.html      # Settings page UI
│       └── settings.js        # Settings management, export/import functionality
├── icon*.png                  # Extension icons (16px, 48px, 128px)
├── syntax-test.html           # Simple syntax validation test
└── TEST_INSTRUCTIONS.md       # Detailed manual testing procedures
```

### Important Code Locations
- **Price fetching logic**: `src/background.js` → `fetchItemPrice()` function
- **Notification system**: `src/background.js` → `sendNotification()` and `updateBadge()` functions  
- **Watchlist management**: `src/popup/popup.js` → `displayWatchlist()` function
- **RuneScape page integration**: `src/content.js` → `extractItemData()` function
- **Settings persistence**: `src/settings/settings.js` → uses `chrome.storage.sync`

## Critical Notes

### No Build Process Required
- This extension uses pure JavaScript/HTML/CSS
- Files are loaded directly by Chrome - no webpack, babel, or compilation needed
- Do NOT try to run npm build, make, or similar build commands - they don't exist

### Storage and Permissions
- Uses `chrome.storage.sync` for watchlist and settings (syncs across devices)
- Uses `chrome.storage.local` for price history data (device-only)
- Requires permissions: `activeTab`, `storage`, `notifications`, `alarms`, `host_permissions` for RuneScape

### Testing Limitations
- Cannot fully test notification functionality in headless Chrome
- Some features require real RuneScape website interaction
- Background script timing depends on Chrome's alarm system (5-minute intervals)
- Manual testing is REQUIRED for complete validation

### Timing Expectations
- **JavaScript validation**: <1 second total
- **ESLint installation**: ~2 seconds  
- **ESLint linting**: ~0.5 seconds
- **Chrome extension loading**: ~0.5 seconds
- **Manual testing**: 5-15 minutes depending on scenarios
- **Background price updates**: 5 minutes (Chrome alarm interval)

## Troubleshooting

### Extension Won't Load
- Check `chrome://extensions/` for error messages
- Verify `manifest.json` syntax with Python JSON parser
- Ensure all JavaScript files have valid syntax

### Notifications Not Working  
- Check Chrome notification permissions
- Verify `chrome.notifications` permission in manifest
- Test with simple notification in background script console

### Price Updates Failing
- Check network connectivity to https://secure.runescape.com/
- Look for CORS errors in background script console
- Verify Chrome alarms are working (check every 5 minutes)

### Settings Not Persisting
- Check `chrome.storage.sync` quota limits
- Verify Chrome sync is enabled in browser
- Look for storage errors in settings page console

**Remember**: Always validate syntax → test extension loading → perform manual scenarios → check all console logs for errors.