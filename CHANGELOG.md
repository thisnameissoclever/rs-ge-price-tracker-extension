# Changelog

All notable changes to the RS Grand Exchange Price Tracker extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.3] - 2025-08-10

### Updated
- **Version Bump**: Updated version to 1.3.3 for release with all settings fixes and improvements

## [1.3.2] - 2025-08-09

### Fixed
- **Auto-refresh on Open Setting**: Fixed "Auto-refresh on Open" setting - now properly respects when disabled
- **Background Updates Setting**: Fixed "Background Updates" setting - now properly stops/starts automatic price checking
- **Settings Update Handling**: Improved handling of background alarm creation/destruction when settings change

### Added
- **Alert Threshold Implementation**: Alert threshold setting now properly triggers notifications for percentage-based price changes
- **Default Alert Type**: New items can automatically have thresholds set based on defaultAlertType setting ('above', 'below', 'both', 'none')
- **Auto-Remove by Time**: Items can now be automatically removed after N days (autoRemoveDays setting)
- **Alert Snoozing**: Implemented snooze duration to prevent spam notifications for the same alert
- **Comprehensive Settings Validation**: All settings now properly apply their intended behavior

### Changed
- **Enhanced Settings Architecture**: Unified settings handling across all extension components
- **Background Script Improvements**: Better handling of settings-dependent background operations
- **Notification System**: Improved notification logic with proper snoozing and auto-removal

## [1.3.1] - 2025-08-09

### Fixed
- **Default Settings Initialization**: Settings now properly initialize with correct default values on first install
- **Settings Consistency**: Fixed inconsistent fallback values across popup, background, and settings components
- **Extension Startup**: Settings are now properly initialized on both extension install and browser startup
- **Settings Page**: Settings page now saves default values if none exist previously
- **Price Format Defaults**: Corrected default price format from 'auto' to 'gp' throughout the extension

### Changed
- **Settings Management**: Unified settings retrieval with proper default handling across all components
- **Background Script**: Enhanced installation and startup handlers to ensure settings are always initialized
- **Popup Interface**: Improved settings loading with proper error handling and fallback to defaults

## [1.3.0] - 2025-08-09

### Added
- **Item Images**: Watchlist items now display official RuneScape Grand Exchange item images for easy visual identification
- **Image Support in Both Views**: Images appear in both compact and full view modes with appropriate sizing
- **Automatic Image URL Generation**: Extension automatically generates image URLs for items using RuneScape's standard pattern
- **Current Page Item Images**: Item images also appear when viewing an item page with the "Add to Watchlist" section
- **Fallback Image Handling**: If an image fails to load, it gracefully hides without breaking the layout

### Changed
- **Enhanced Visual Layout**: Watchlist items now have improved layouts to accommodate item images
- **Content Script Improvements**: Enhanced item data extraction to include image URLs from Grand Exchange pages
- **Popup Layout Updates**: Redesigned item display to show images alongside item names and prices

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
