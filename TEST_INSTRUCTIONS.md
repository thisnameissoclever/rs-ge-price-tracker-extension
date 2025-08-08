# RS Grand Exchange Price Tracker - Testing Instructions

## Issues Fixed

### 1. **Persistent Notifications**
- **Problem**: Notifications were basic and could be easily dismissed
- **Solution**: Added `requireInteraction: true` and `priority: 2` to make notifications persistent until manually dismissed

### 2. **Extension Badge Counter**
- **Problem**: No visual indication of alert count on extension icon  
- **Solution**: Added `updateBadge()` function that shows red badge with count of items exceeding thresholds

### 3. **Alert Detection**
- **Problem**: Badge and alert counting was not implemented
- **Solution**: Added alert counting logic in `checkPricesAndAlert()` and `updateBadgeFromWatchlist()`

## Key Changes Made

### Background Script (`src/background.js`)
1. **Enhanced `sendNotification()` function**:
   - Added `requireInteraction: true` for persistent notifications
   - Added `priority: 2` for high priority
   - Added alert type parameter for future icon customization

2. **New `updateBadge()` function**:
   - Sets badge text to alert count
   - Sets badge color (red for alerts, gray for none)
   - Includes error handling

3. **New `updateBadgeFromWatchlist()` function**:
   - Calculates current alert count from watchlist
   - Updates badge automatically
   - Called on extension start, install, and after watchlist changes

4. **Enhanced `checkPricesAndAlert()` function**:
   - Now counts items exceeding thresholds
   - Updates badge with current alert count
   - Better logging for debugging

5. **Added notification click handler**:
   - Clears notifications when clicked
   - Could be extended to open specific items

### Popup Script (`src/popup/popup.js`)
1. **Enhanced `displayWatchlist()` function**:
   - Shows alert count in watchlist title
   - Sorts items with alerts to the top
   - Better visual organization

### Manifest (`manifest.json`)
1. **Added "action" permission** for badge functionality

### Popup HTML (`src/popup/popup.html`)
1. **Enhanced alert styling**:
   - Brighter borders for alerts
   - Added pulsing animation for alert items
   - More prominent visual indicators

## How to Test

### 1. **Load the Extension**
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the extension folder
4. The extension icon should appear in the toolbar

### 2. **Add Items to Watchlist**
1. Go to RuneScape Grand Exchange: https://secure.runescape.com/m=itemdb_rs/
2. Navigate to any item page (e.g., search for "Dragon scimitar")
3. Click the extension icon - you should see "Add to Watchlist" button
4. Add the item and set price thresholds

### 3. **Test Badge Functionality**
1. Set low/high thresholds for your items
2. The badge should update to show alert count
3. Items exceeding thresholds should show in red/green with pulsing animation

### 4. **Test Notifications**
1. Wait for the 5-minute price check cycle, or click "Refresh Prices"
2. If any prices cross thresholds, you should get persistent notifications
3. Notifications should require manual dismissal
4. Badge should show current alert count

### 5. **Verify Persistence**
- Notifications should stay visible until you dismiss them
- Badge count should persist across browser sessions
- Alert styling should be prominent in the popup

## Expected Behavior

### Notifications
- **Title**: "{Item Name} - LOW/HIGH PRICE ALERT!"
- **Message**: "Price dropped/rose to {price} gp (threshold: {threshold} gp)"
- **Behavior**: Persistent, high priority, requires manual dismissal

### Badge
- **No Alerts**: No badge or empty badge
- **With Alerts**: Red badge showing number (e.g., "3")
- **Updates**: Automatically when thresholds are crossed or updated

### Popup
- **Alert Count**: Shown in watchlist title "(X alerts)"
- **Sorting**: Alert items appear at top
- **Styling**: Pulsing red/green borders for alert items

## Troubleshooting

### Notifications Not Appearing
1. Check if notifications are enabled for Chrome/extension
2. Look in browser console for error messages
3. Verify extension has "notifications" permission

### Badge Not Showing
1. Check if "action" permission is granted
2. Verify watchlist items have thresholds set
3. Check browser console for badge-related errors

### Price Updates Not Working
1. Verify internet connection to RuneScape website
2. Check if alarms are working (background script should log every 5 minutes)
3. Look for CORS or fetch errors in console

## Debug Information
- Background script logs are visible in: Extensions → RS GE Price Tracker → Service Worker → Console
- Popup logs are in regular browser DevTools when popup is open
- All major functions include console.log statements for debugging
