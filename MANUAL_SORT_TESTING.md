# Manual Sort Order with Drag-and-Drop Testing Instructions

## Overview
This document provides comprehensive testing instructions for the new manual sort order and drag-and-drop functionality implemented in the RS GE Price Tracker extension.

## Features Implemented

### 1. Manual Sort Option in Settings
- **Location**: Settings page → Sort Order dropdown
- **Position**: First option in the dropdown
- **Behavior**: When selected, items maintain their custom order instead of auto-sorting

### 2. Drag-and-Drop Functionality
- **Visual Elements**: Drag handles (⋮⋮) appear on all watchlist items
- **Views Supported**: Both normal view and compact view
- **Visual Feedback**: Items rotate 3° and get enhanced shadow when dragging
- **Auto-switch**: Dragging automatically switches sort order to "Manual"

### 3. Storage and Ordering
- **New Items**: When sort order is manual, new items are added to the beginning
- **Persistence**: Manual order is saved and restored across browser sessions
- **Cleanup**: Manual order is cleaned up when items are removed

## Testing Scenarios

### Scenario 1: Enable Manual Sorting
1. **Load Extension**: Open the extension popup
2. **Access Settings**: Click the "⚙️ Settings" button
3. **Navigate to Sort Order**: Find the "Sort Order" setting
4. **Select Manual**: Choose "Manual" from the dropdown (first option)
5. **Verify Auto-save**: Confirm "Auto-saved!" message appears
6. **Return to Popup**: Close settings and return to watchlist

**Expected Results**:
- Manual option appears as first choice in Sort Order dropdown
- Settings auto-save when changed
- Watchlist items maintain their current order when switched to manual

### Scenario 2: Test Normal View Drag-and-Drop
**Prerequisites**: Have at least 3 items in watchlist with manual sorting enabled

1. **Identify Drag Handles**: Look for "⋮⋮" symbols in top-left corner of each item
2. **Test Hover Effect**: Hover over drag handle - cursor should change to grab cursor, handle should glow yellow
3. **Perform Drag**: Click and drag the drag handle of the first item
4. **Visual Feedback**: Confirm item rotates 3° and gets shadow during drag
5. **Drop Item**: Drop the item in a different position
6. **Verify Reorder**: Confirm items are reordered visually
7. **Test Persistence**: Refresh the popup and verify order is maintained

**Expected Results**:
- Drag handles visible and responsive in normal view
- Visual feedback during dragging (rotation, shadow)
- Items reorder smoothly with animation
- Order persists after popup refresh

### Scenario 3: Test Compact View Drag-and-Drop
1. **Enable Compact View**: Go to Settings → Check "Compact View"
2. **Return to Watchlist**: Verify items are now in compact layout
3. **Identify Drag Handles**: Look for "⋮⋮" symbols at the left edge of compact items
4. **Test Drag in Compact**: Drag and drop items in compact view
5. **Verify Functionality**: Ensure drag-and-drop works the same as normal view

**Expected Results**:
- Drag handles positioned appropriately in compact view
- Drag-and-drop works identically to normal view
- Visual feedback appropriate for compact layout

### Scenario 4: Auto-Switch to Manual Mode
**Prerequisites**: Have sort order set to something other than "Manual"

1. **Set Different Sort**: Go to Settings → Set Sort Order to "Item Name"
2. **Verify Sorting**: Return to popup, confirm items are sorted alphabetically
3. **Perform Drag**: Drag any item to a different position
4. **Check Auto-Switch**: Verify that dragging automatically switches to Manual mode
5. **Confirm in Settings**: Open settings and verify Sort Order now shows "Manual"

**Expected Results**:
- Items initially sorted by name (or other selected method)
- Dragging an item automatically switches to manual mode
- Setting is updated in settings page
- Items maintain dragged order

### Scenario 5: New Item Placement in Manual Mode
**Prerequisites**: Manual sort order enabled

1. **Add New Item**: Visit a RuneScape GE item page and add item to watchlist
2. **Check Placement**: Return to extension popup
3. **Verify Position**: Confirm new item appears at the beginning (top) of the list
4. **Test Multiple Adds**: Add several new items and confirm they stack at the beginning

**Expected Results**:
- New items appear at the beginning of watchlist when manual sort is active
- Multiple new items stack in reverse chronological order at the top

### Scenario 6: Non-Manual Mode Behavior
1. **Set Sort Order**: Choose any non-manual sort option (e.g., "Current Price")
2. **Verify Auto-Sort**: Confirm items automatically sort by selected criteria
3. **Add New Item**: Add a new item to watchlist
4. **Check Integration**: Verify new item is sorted into correct position automatically
5. **Test Sort Change**: Change between different non-manual sort options

**Expected Results**:
- Items automatically sort when non-manual options selected
- New items are automatically positioned by sort criteria
- Sort order changes take effect immediately

### Scenario 7: Visual and UX Testing
1. **Drag Handle Visibility**: Verify drag handles are clearly visible but not intrusive
2. **Cursor Changes**: Confirm cursor changes appropriately (grab/grabbing)
3. **Animation Quality**: Test drag animations are smooth and responsive
4. **Accessibility**: Test with keyboard navigation where possible
5. **Mobile/Touch**: If testing on touch devices, verify drag works with touch gestures

**Expected Results**:
- Professional, polished visual design
- Intuitive user experience
- Smooth animations and interactions
- Consistent behavior across different input methods

## Error Recovery Testing

### Test Extension Reload
1. **Set Manual Order**: Arrange items in custom order
2. **Reload Extension**: Disable and re-enable the extension
3. **Verify Persistence**: Confirm manual order is maintained

### Test Storage Cleanup
1. **Set Manual Order**: Arrange items in custom order
2. **Remove Items**: Remove some items from watchlist
3. **Check Storage**: Verify manual order storage is cleaned up properly

### Test Conflicting Sort Changes
1. **Set Manual Order**: Arrange items manually
2. **Quick Sort Change**: Rapidly change sort options in settings
3. **Return to Manual**: Switch back to manual mode
4. **Verify State**: Confirm extension handles rapid changes gracefully

## Browser Compatibility Testing
Test the above scenarios in:
- **Chrome** (primary target)
- **Edge** (Chromium-based)
- **Firefox** (if extension supports it)

## Performance Testing
1. **Large Watchlists**: Test with 10+ items in watchlist
2. **Rapid Interactions**: Perform rapid drag-and-drop operations
3. **Memory Usage**: Monitor for any memory leaks during extended use

## Success Criteria
✅ All drag-and-drop operations work smoothly in both views  
✅ Manual sort order persists across sessions  
✅ Auto-switch to manual mode functions correctly  
✅ New items are properly positioned in manual mode  
✅ Visual feedback is professional and intuitive  
✅ No JavaScript errors in console  
✅ Extension loads quickly and responds smoothly  
✅ Settings integration works seamlessly  

## Troubleshooting
If issues are found:
1. **Check Console**: Open browser DevTools → Console for JavaScript errors
2. **Verify Storage**: Check Chrome DevTools → Application → Storage
3. **Test Isolation**: Test with fresh extension installation
4. **Document Issues**: Note specific steps to reproduce problems

## Screenshots
Take screenshots of:
- Settings page showing Manual sort option
- Normal view with drag handles visible
- Compact view with drag handles
- Items being dragged (showing visual feedback)
- Before/after reordering

This testing should comprehensively validate the manual sort order and drag-and-drop implementation.