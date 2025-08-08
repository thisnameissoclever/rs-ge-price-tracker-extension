# Changelog

All notable changes to the RS Grand Exchange Price Tracker extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-08-08

### Added
- **Persistent Browser Notifications**: Notifications now require manual dismissal using `requireInteraction: true`
- **Extension Badge Counter**: Red badge on extension icon shows count of items exceeding thresholds
- **High Priority Notifications**: Notifications use priority level 2 for better visibility
- **Dynamic Alert Counting**: Real-time counting of items that have crossed their price thresholds
- **Enhanced Visual Alerts**: Popup items with alerts now have pulsing borders and prominent styling
- **Alert Status Sorting**: Items with active alerts are automatically sorted to the top of the watchlist
- **Badge Management**: Badge automatically updates when items are added/removed or thresholds change
- **Notification Click Handling**: Clicking notifications dismisses them properly

### Changed
- **Track Button Positioning**: Fixed button being hidden behind Grand Exchange header
- **Dynamic Header Detection**: Button now intelligently positions based on detected header height
- **Message Positioning**: Success/error messages now appear below the track button instead of overlapping
- **Alert Item Styling**: Items exceeding thresholds now have more prominent visual indicators
- **Watchlist Title**: Shows alert count when items have active alerts (e.g., "Your Watchlist (3 alerts)")

### Fixed
- **Button Visibility**: "Track this item" button no longer hidden by page header
- **Notification Persistence**: Notifications no longer auto-dismiss, requiring user interaction
- **Badge Updates**: Extension badge properly reflects current alert state
- **Visual Feedback**: Clear indication when items cross price thresholds

### Technical Improvements
- Added `updateBadge()` and `updateBadgeFromWatchlist()` functions for badge management
- Enhanced `checkPricesAndAlert()` to count and track alert states
- Improved `sendNotification()` with alert type parameters and better error handling
- Added notification click listener for better user experience
- Updated manifest.json with "action" permission for badge functionality
- Added CSS animations for pulsing alert effects

## [1.1.0] - 2025-08-07

### Added
- Basic notification system for price alerts
- Watchlist management with add/remove functionality
- Price threshold setting (high/low alerts)
- Periodic price checking every 5 minutes
- Item tracking from Grand Exchange pages
- Popup interface for managing tracked items

### Features
- Content script injection on RuneScape Grand Exchange pages
- Background service worker for continuous price monitoring
- Local storage for watchlist persistence
- Price extraction from RuneScape item pages
- Manual price refresh functionality

## [1.0.0] - 2025-08-06

### Added
- Initial release of RS Grand Exchange Price Tracker
- Basic extension structure and manifest
- Content script for item page detection
- Background script foundation
- Popup interface foundation
