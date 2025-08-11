// Background script for RS Grand Exchange Price Tracker
console.log('Background script loaded');

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed');
  
  // Initialize default settings on first install
  try {
    const result = await chrome.storage.sync.get('settings');
    if (!result.settings) {
      console.log('First install: Initializing default settings');
      await chrome.storage.sync.set({ settings: defaultSettings });
      console.log('Default settings saved:', defaultSettings);
    } else {
      console.log('Settings already exist:', result.settings);
      // Merge any new default settings with existing ones
      const mergedSettings = { ...defaultSettings, ...result.settings };
      await chrome.storage.sync.set({ settings: mergedSettings });
      console.log('Settings updated with new defaults:', mergedSettings);
    }
  } catch (error) {
    console.error('Error initializing settings:', error);
  }
  
  // Create alarm for periodic price checking using settings
  const settings = await getSettings();
  chrome.alarms.create('priceCheck', { 
    delayInMinutes: 1, 
    periodInMinutes: settings.updateInterval || 5
  });
  
  // Update badge on install
  updateBadgeFromWatchlist();
});

// Update badge on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started');
  
  // Ensure settings are initialized on startup
  try {
    const result = await chrome.storage.sync.get('settings');
    if (!result.settings) {
      console.log('Extension startup: Initializing default settings');
      await chrome.storage.sync.set({ settings: defaultSettings });
    }
  } catch (error) {
    console.error('Error initializing settings on startup:', error);
  }
  
  updateBadgeFromWatchlist();
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  
  if (message.action === 'addItem') {
    addItemToWatchlist(message.itemData)
      .then(result => {
        updateBadgeFromWatchlist(); // Update badge after adding item
        sendResponse({ success: true, data: result });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
  
  if (message.action === 'getWatchlist') {
    getWatchlist()
      .then(watchlist => sendResponse({ success: true, data: watchlist }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'removeItem') {
    removeItemFromWatchlist(message.itemId)
      .then(() => {
        updateBadgeFromWatchlist(); // Update badge after removing item
        sendResponse({ success: true });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'updateThresholds') {
    updateItemThresholds(message.itemId, message.lowPrice, message.highPrice)
      .then(() => {
        updateBadgeFromWatchlist(); // Update badge after updating thresholds
        sendResponse({ success: true });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'refreshPrices') {
    checkPricesAndAlert()
      .then(() => {
        // Return updated watchlist
        return getWatchlist();
      })
      .then(watchlist => sendResponse({ success: true, data: watchlist }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'refreshWatchlist') {
    updateBadgeFromWatchlist()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // Handle settings messages
  if (message.type === 'SETTINGS_UPDATED') {
    handleSettingsUpdate(message.settings);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'GET_SETTINGS') {
    getSettings()
      .then(settings => sendResponse({ success: true, settings }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Handle alarms for periodic price checking
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'priceCheck') {
    // Check if background updates are enabled
    const settings = await getSettings();
    if (settings.backgroundUpdates) {
      checkPricesAndAlert();
    } else {
      console.log('Background updates disabled - skipping price check');
    }
  }
});

// Handle notification clicks - open the extension popup
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('Notification clicked:', notificationId);
  
  // Clear the clicked notification
  chrome.notifications.clear(notificationId);
  
  // Could open the extension popup here, but since it's a service worker,
  // we'll let the user click the extension icon instead
});

// Add item to watchlist
async function addItemToWatchlist(itemData) {
  try {
    console.log('🔧 Background: Adding item to watchlist:', itemData);
    const watchlist = await getWatchlist();
    
    console.log('📊 Current watchlist before adding:', Object.keys(watchlist));
    
    // Use the item ID from the data
    const itemId = itemData.id;
    
    if (!itemId) {
      throw new Error('No item ID provided');
    }
    
    // Ensure we have a clean URL for fetching - construct it from item ID
    const fetchUrl = `https://secure.runescape.com/m=itemdb_rs/viewitem?obj=${itemId}`;
    
    // If no name provided, try to extract from URL
    let itemName = itemData.name;
    if (!itemName && itemData.url) {
      const urlPath = new URL(itemData.url).pathname;
      const pathMatch = urlPath.match(/\/m=itemdb_rs\/([^\/]+)\//);
      if (pathMatch) {
        itemName = decodeURIComponent(pathMatch[1]).replace(/\+/g, ' ');
      }
    }
    
    if (!itemName) {
      itemName = `Item ${itemId}`; // Fallback name
    }
    
    console.log('✏️ Creating watchlist entry for:', { itemId, itemName, currentPrice: itemData.currentPrice, imageUrl: itemData.imageUrl });
    
    // Get settings for default alert behavior
    const settings = await getSettings();
    let lowThreshold = null;
    let highThreshold = null;
    
    // Apply default alert thresholds based on current price and defaultAlertType setting
    if (itemData.currentPrice && settings.defaultAlertType !== 'none') {
      const price = itemData.currentPrice;
      const percentage = settings.alertThreshold || 10; // Use alertThreshold setting for percentage
      
      if (settings.defaultAlertType === 'below' || settings.defaultAlertType === 'both') {
        lowThreshold = Math.floor(price * (1 - percentage / 100));
      }
      if (settings.defaultAlertType === 'above' || settings.defaultAlertType === 'both') {
        highThreshold = Math.ceil(price * (1 + percentage / 100));
      }
      
      console.log(`Applied default thresholds (${settings.defaultAlertType}, ${percentage}%): low=${lowThreshold}, high=${highThreshold}`);
    }
    
    watchlist[itemId] = {
      id: itemId,
      name: itemName,
      url: fetchUrl, // Use the clean URL for fetching
      originalUrl: itemData.url, // Keep the original URL for reference
      currentPrice: itemData.currentPrice || null,
      imageUrl: itemData.imageUrl || null, // Store the image URL
      lowThreshold: lowThreshold,
      highThreshold: highThreshold,
      lastChecked: Date.now(),
      addedAt: Date.now()
    };
    
    await chrome.storage.sync.set({ watchlist });
    console.log('💾 Item saved to sync storage. Updated watchlist keys:', Object.keys(watchlist));
    console.log('🎯 Newly added item data:', watchlist[itemId]);
    
    // Immediately verify the save worked
    const verifyResult = await chrome.storage.sync.get(['watchlist']);
    const verifiedWatchlist = verifyResult.watchlist || {};
    console.log('✅ Verification - Item exists in sync storage:', !!verifiedWatchlist[itemId]);
    
    console.log('Item added to watchlist:', itemName, 'with ID:', itemId);
    
    // Immediately try to fetch current price if we don't have one
    if (!itemData.currentPrice) {
      console.log('No current price available, fetching immediately...');
      const currentPrice = await fetchItemPrice(fetchUrl, itemId);
      if (currentPrice !== null) {
        watchlist[itemId].currentPrice = currentPrice;
        watchlist[itemId].lastChecked = Date.now();
        await chrome.storage.sync.set({ watchlist });
        console.log('Updated price for newly added item:', currentPrice);
      }
    }
    
    return watchlist[itemId];
  } catch (error) {
    console.error('Error adding item to watchlist:', error);
    throw error;
  }
}

// Get watchlist
// Migrate watchlist from local to sync storage
async function migrateWatchlistToSync(watchlist) {
  try {
    const watchlistSize = JSON.stringify(watchlist).length;
    console.log(`Migrating watchlist (${watchlistSize} bytes) to sync storage...`);
    
    // Check if watchlist exceeds sync storage limits (100KB total, but be conservative)
    if (watchlistSize > 80000) { // 80KB limit to be safe
      console.warn('Watchlist too large for sync storage, keeping in local storage');
      throw new Error('Watchlist too large for sync storage');
    }
    
    // Save to sync storage
    await chrome.storage.sync.set({ watchlist });
    
    // Clear from local storage after successful migration
    await chrome.storage.local.remove(['watchlist']);
    
    console.log('✅ Successfully migrated watchlist to sync storage');
  } catch (error) {
    console.error('❌ Failed to migrate watchlist to sync storage:', error);
    throw error;
  }
}

// Get watchlist from storage (now synced across devices)
async function getWatchlist() {
  try {
    // First try to get from sync storage
    const syncResult = await chrome.storage.sync.get(['watchlist']);
    
    // If we have data in sync storage, use it
    if (syncResult.watchlist && Object.keys(syncResult.watchlist).length > 0) {
      return syncResult.watchlist;
    }
    
    // Otherwise, check if we have data in local storage (for migration)
    const localResult = await chrome.storage.local.get(['watchlist']);
    if (localResult.watchlist && Object.keys(localResult.watchlist).length > 0) {
      console.log('Migrating watchlist from local to sync storage...');
      await migrateWatchlistToSync(localResult.watchlist);
      return localResult.watchlist;
    }
    
    return {};
  } catch (error) {
    console.error('Error getting watchlist from sync storage, falling back to local:', error);
    // Fallback to local storage if sync fails
    const result = await chrome.storage.local.get(['watchlist']);
    return result.watchlist || {};
  }
}

// Remove item from watchlist
async function removeItemFromWatchlist(itemId) {
  try {
    const watchlist = await getWatchlist();
    
    if (watchlist[itemId]) {
      delete watchlist[itemId];
      await chrome.storage.sync.set({ watchlist });
      console.log('Item removed from watchlist:', itemId);
    }
  } catch (error) {
    console.error('Error removing item from watchlist:', error);
    throw error;
  }
}

// Update item thresholds with retry on conflict
async function updateItemThresholds(itemId, lowPrice, highPrice) {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const watchlist = await getWatchlist();
      
      if (watchlist[itemId]) {
        watchlist[itemId].lowThreshold = lowPrice;
        watchlist[itemId].highThreshold = highPrice;
        
        // Use a unique timestamp to detect conflicts
        const updateTimestamp = Date.now();
        watchlist[itemId].lastThresholdUpdate = updateTimestamp;
        
        await chrome.storage.sync.set({ watchlist });
        
        // Verify the update wasn't overwritten by checking the timestamp
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
        const verifyWatchlist = await getWatchlist();
        
        if (verifyWatchlist[itemId] && verifyWatchlist[itemId].lastThresholdUpdate === updateTimestamp) {
          console.log('Thresholds updated successfully for item:', itemId);
          return; // Success
        } else {
          throw new Error('Update was overwritten by concurrent operation');
        }
      } else {
        throw new Error('Item not found in watchlist');
      }
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        console.error('Error updating thresholds after retries:', error);
        throw error;
      }
      console.warn(`Threshold update attempt ${retries} failed, retrying:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 100 * retries)); // Exponential backoff
    }
  }
}

// Extract item ID from RS URL
function extractItemIdFromUrl(url) {
  const match = url.match(/obj=(\d+)/);
  return match ? match[1] : null;
}

// Check prices and send alerts
async function checkPricesAndAlert() {
  try {
    console.log('Starting price check cycle...');
    const watchlist = await getWatchlist();
    const settings = await getSettings();
    
    const itemIds = Object.keys(watchlist);
    console.log(`Checking prices for ${itemIds.length} items`);
    
    if (itemIds.length === 0) {
      console.log('No items to check');
      updateBadge(0); // Clear badge when no items
      return;
    }
    
    let alertCount = 0;
    let itemsToRemove = []; // Track items to auto-remove
    
    // Check for time-based auto-removal first
    if (settings.autoRemoveDays > 0) {
      const cutoffTime = Date.now() - (settings.autoRemoveDays * 24 * 60 * 60 * 1000);
      for (const itemId of itemIds) {
        const item = watchlist[itemId];
        if (item.addedAt && item.addedAt < cutoffTime) {
          console.log(`Auto-removing old item: ${item.name} (added ${Math.floor((Date.now() - item.addedAt) / (24 * 60 * 60 * 1000))} days ago)`);
          itemsToRemove.push(itemId);
          delete watchlist[itemId];
        }
      }
      
      // Save watchlist if items were removed
      if (itemsToRemove.length > 0) {
        await chrome.storage.sync.set({ watchlist });
        console.log(`Auto-removed ${itemsToRemove.length} old items`);
      }
    }
    
    // Check each remaining item
    for (const itemId of Object.keys(watchlist)) {
      const item = watchlist[itemId];
      console.log(`Checking price for ${item.name} (ID: ${itemId})`);
      
      try {
        // Fetch current price from RS page
        const currentPrice = await fetchItemPrice(item.url, itemId);
        
        if (currentPrice !== null && currentPrice !== item.currentPrice) {
          console.log(`Price update for ${item.name}: ${item.currentPrice} → ${currentPrice}`);
          
          // Update stored price
          const previousPrice = item.currentPrice;
          item.currentPrice = currentPrice;
          item.lastChecked = Date.now();
          
          // Check thresholds and send notifications
          let notificationSent = false;
          let shouldAutoRemove = false;
          
          // Load settings for auto-remove
          const settings = await getSettings();
          
          if (item.lowThreshold && currentPrice <= item.lowThreshold) {
            // Check if item is snoozed
            const now = Date.now();
            if (!item.lastLowAlert || (now - item.lastLowAlert) >= settings.snoozeDuration) {
              await sendNotification(`${item.name} - LOW PRICE ALERT!`, 
                `Price dropped to ${formatPriceExact(currentPrice)} gp (threshold: ${formatPriceExact(item.lowThreshold)} gp)`,
                'low');
              notificationSent = true;
              item.lastLowAlert = now; // Set snooze timestamp
              // Auto-remove if autoRemoveDays is set to 0 (immediate removal)
              if (settings.autoRemoveDays === 0) shouldAutoRemove = true;
            } else {
              console.log(`Low alert snoozed for ${item.name} (${Math.floor((settings.snoozeDuration - (now - item.lastLowAlert)) / 60000)} minutes remaining)`);
            }
          }
          
          if (item.highThreshold && currentPrice >= item.highThreshold) {
            // Check if item is snoozed
            const now = Date.now();
            if (!item.lastHighAlert || (now - item.lastHighAlert) >= settings.snoozeDuration) {
              await sendNotification(`${item.name} - HIGH PRICE ALERT!`, 
                `Price rose to ${formatPriceExact(currentPrice)} gp (threshold: ${formatPriceExact(item.highThreshold)} gp)`,
                'high');
              notificationSent = true;
              item.lastHighAlert = now; // Set snooze timestamp
              // Auto-remove if autoRemoveDays is set to 0 (immediate removal)  
              if (settings.autoRemoveDays === 0) shouldAutoRemove = true;
            } else {
              console.log(`High alert snoozed for ${item.name} (${Math.floor((settings.snoozeDuration - (now - item.lastHighAlert)) / 60000)} minutes remaining)`);
            }
          }
          
          // Auto-remove item if threshold triggered and setting enabled
          if (shouldAutoRemove) {
            console.log(`Auto-removing item ${item.name} after threshold alert`);
            delete watchlist[itemId];
            itemsToRemove.push(itemId);
          }
          
          // Also notify of significant price changes (10% or more, or custom threshold)
          if (!notificationSent && previousPrice && previousPrice > 0) {
            const changePercent = Math.abs((currentPrice - previousPrice) / previousPrice * 100);
            
            // Use settings for alert threshold
            if (changePercent >= settings.alertThreshold) {
              const direction = currentPrice > previousPrice ? 'increased' : 'decreased';
              await sendNotification(`${item.name} - Price Change`, 
                `Price ${direction} ${changePercent.toFixed(1)}% to ${formatPriceExact(currentPrice)} gp`,
                'change');
            }
          }
          
        } else if (currentPrice !== null) {
          // Price is the same, just update last checked time
          item.lastChecked = Date.now();
          console.log(`Price unchanged for ${item.name}: ${formatPriceExact(currentPrice)} gp`);
        } else {
          console.log(`Failed to fetch price for ${item.name}`);
        }
        
        // Count items exceeding thresholds for badge
        if (currentPrice !== null) {
          if ((item.lowThreshold && currentPrice <= item.lowThreshold) || 
              (item.highThreshold && currentPrice >= item.highThreshold)) {
            alertCount++;
          }
        }
        
        // Small delay between requests to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error checking price for item ${itemId}:`, error);
      }
    }
    
    // Update badge with alert count
    updateBadge(alertCount);
    
    // Save updated watchlist with conflict resolution
    try {
      // Get the latest watchlist to check for any manual threshold updates during price checking
      const latestWatchlist = await getWatchlist();
      
      // Merge changes: preserve manual threshold updates, apply price updates
      for (const itemId of Object.keys(watchlist)) {
        if (latestWatchlist[itemId]) {
          // If thresholds were updated manually during price check (newer lastThresholdUpdate),
          // preserve the manual thresholds but apply price updates
          const latestItem = latestWatchlist[itemId];
          const ourItem = watchlist[itemId];
          
          if (latestItem.lastThresholdUpdate && 
              (!ourItem.lastThresholdUpdate || latestItem.lastThresholdUpdate > ourItem.lastThresholdUpdate)) {
            console.log(`Preserving manual threshold update for ${ourItem.name}`);
            ourItem.lowThreshold = latestItem.lowThreshold;
            ourItem.highThreshold = latestItem.highThreshold;
            ourItem.lastThresholdUpdate = latestItem.lastThresholdUpdate;
          }
        }
      }
      
      await chrome.storage.sync.set({ watchlist });
    } catch (error) {
      console.error('Error saving updated watchlist with conflict resolution:', error);
      // Fallback to simple save
      await chrome.storage.sync.set({ watchlist });
    }
    
    if (itemsToRemove.length > 0) {
      console.log(`Price check cycle completed. ${itemsToRemove.length} items auto-removed, ${alertCount} remaining items have alerts.`);
    } else {
      console.log(`Price check cycle completed, watchlist updated. ${alertCount} items have alerts.`);
    }
    
  } catch (error) {
    console.error('Error in checkPricesAndAlert:', error);
  }
}

// Fetch item price by visiting the actual RS page
async function fetchItemPrice(itemUrl, itemId) {
  try {
    console.log(`Fetching price for item ${itemId} from ${itemUrl}`);
    
    // Construct the URL using the item ID to ensure we get the right page
    const baseUrl = `https://secure.runescape.com/m=itemdb_rs/viewitem?obj=${itemId}`;
    
    // Fetch the item page HTML with light retry on 5xx
    const doFetch = async () => {
      return fetch(baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
    };

    let response = await doFetch();
    if (!response.ok && response.status >= 500) {
      // Retry up to 2 times on server errors like 504
      for (let attempt = 1; attempt <= 2 && (!response.ok && response.status >= 500); attempt++) {
        const backoff = 500 * attempt; // 0.5s, 1s
        console.warn(`Fetch failed (${response.status}). Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        response = await doFetch();
      }
    }

    if (!response.ok) {
      console.error(`Failed to fetch page: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    console.log(`Fetched HTML length: ${html.length} characters`);
    
    let currentPrice = null;
    let itemName = null;
    
    // Extract item name from page title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const fullTitle = titleMatch[1];
      const nameMatch = fullTitle.match(/^([^-]+)\s*-\s*Grand Exchange/);
      if (nameMatch) {
        itemName = nameMatch[1].trim();
        console.log('Extracted item name from title:', itemName);
      }
    }
    
    // Extract price from JavaScript data - look for the average30 arrays
    try {
      // Look for average30.push patterns which contain the current price
      const average30Matches = html.match(/average30\.push\(\[new Date\([^,]+\),\s*(\d+),\s*\d+\]\);?/g);
      
      if (average30Matches && average30Matches.length > 0) {
        // Get the last (most recent) price entry
        const lastMatch = average30Matches[average30Matches.length - 1];
        const priceMatch = lastMatch.match(/,\s*(\d+),/);
        if (priceMatch) {
          currentPrice = parseInt(priceMatch[1]);
          console.log('Found current price from average30 data:', currentPrice);
        }
      }
      
      // Alternative: look for any large numbers that could be prices
      if (!currentPrice) {
        console.log('No average30 data found, trying alternative methods...');
        
        // Look for script content with price data
        const scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi);
        if (scriptMatches) {
          for (const scriptContent of scriptMatches) {
            // Look for patterns like numbers in the 100k-10billion range
            const largeNumbers = scriptContent.match(/\b(\d{6,10})\b/g);
            if (largeNumbers) {
              for (const numStr of largeNumbers) {
                const num = parseInt(numStr);
                // Filter for reasonable RS item prices (1k to 10 billion)
                if (num >= 1000 && num <= 10000000000) {
                  currentPrice = num;
                  console.log('Found potential price from script:', currentPrice);
                  break;
                }
              }
              if (currentPrice) break;
            }
          }
        }
      }
      
      // Last resort: look for "Current Guide Price" text patterns
      if (!currentPrice) {
        console.log('Trying text-based price extraction...');
        
        const currentGuidePriceMatch = html.match(/Current\s+Guide\s+Price[^0-9]*([0-9,]+(?:\.[0-9]+)?)\s*([KMB])?/i);
        if (currentGuidePriceMatch) {
          let priceText = currentGuidePriceMatch[1].replace(/,/g, '');
          let multiplier = 1;
          
          if (currentGuidePriceMatch[2]) {
            const unit = currentGuidePriceMatch[2].toUpperCase();
            if (unit === 'K') multiplier = 1000;
            if (unit === 'M') multiplier = 1000000;
            if (unit === 'B') multiplier = 1000000000;
          }
          
          currentPrice = Math.floor(parseFloat(priceText) * multiplier);
          console.log('Found price from Current Guide Price text:', currentPrice);
        }
      }
      
    } catch (error) {
      console.error('Error parsing price from HTML:', error);
    }
    
    console.log(`Final extracted data for item ${itemId}:`, { itemName, currentPrice });
    
    // Return the price (we mainly care about price updates in background)
    return currentPrice;
    
  } catch (error) {
    console.error('Error fetching price for item', itemId, ':', error);
    return null;
  }
}

// Notification rate limiting
let notificationHistory = [];

// Send notification
async function sendNotification(title, message, alertType = 'alert') {
  // Load notification settings with proper defaults
  const settings = await getSettings();
  
  if (settings.desktopNotifications === false) {
    console.log('Desktop notifications disabled in settings. Skipping notification:', title);
    return;
  }
  
  const notificationDuration = settings.notificationDuration || settings.alertDuration || 5; // Default 5 seconds
  const notificationLimit = settings.notificationLimit || 10; // Default 10 per hour
  const soundAlerts = settings.soundAlerts;
  
  // Check rate limiting
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000); // 1 hour in milliseconds
  
  // Clean old notifications from history
  notificationHistory = notificationHistory.filter(timestamp => timestamp > oneHourAgo);
  
  // Check if we've hit the limit
  if (notificationHistory.length >= notificationLimit) {
    console.log(`Notification rate limit reached (${notificationLimit}/hour). Skipping notification:`, title);
    return;
  }
  
  // Add current notification to history
  notificationHistory.push(now);
  
  const notificationId = `alert-${Date.now()}-${Math.random()}`;
  
  // Choose icon based on alert type
  let iconUrl = 'icon128.png';
  if (alertType === 'low') {
    iconUrl = 'icon128.png'; // Could use a different icon for low alerts
  } else if (alertType === 'high') {
    iconUrl = 'icon128.png'; // Could use a different icon for high alerts
  }
  
  // Set requireInteraction based on duration (0 = persistent)
  const requireInteraction = notificationDuration === 0;
  
  // Use absolute URL for icon to avoid resolution issues from service worker
  const resolvedIconUrl = chrome.runtime.getURL(iconUrl);

  // Note: chrome.notifications API doesn't support controlling sound via a 'silent' option.
  // The 'silent' field belongs to the Web Notifications API, not chrome.notifications.
  const options = {
    type: 'basic',
    iconUrl: resolvedIconUrl,
    title: title,
    message: message,
    requireInteraction: requireInteraction,
    priority: 2, // High priority
    isClickable: true
  };
  
  chrome.notifications.create(notificationId, options, (createdId) => {
    if (chrome.runtime.lastError) {
      const err = chrome.runtime.lastError;
      console.error('Error creating notification:', err.message || err);
      return;
    }
    // Sound control isn't available via chrome.notifications; log setting for transparency
    console.log('Notification created:', createdId, soundAlerts ? '(sound setting: on)' : '(sound setting: off - not controllable by API)');
    
    // Auto-close notification after specified duration (unless persistent)
    if (notificationDuration > 0) {
      setTimeout(() => {
        chrome.notifications.clear(createdId);
      }, notificationDuration * 1000);
    }
  });
}

// Update extension badge with alert count
function updateBadge(alertCount) {
  const badgeText = alertCount > 0 ? alertCount.toString() : '';
  const badgeColor = alertCount > 0 ? '#e74c3c' : '#34495e'; // Red for alerts, gray for none
  
  chrome.action.setBadgeText({ text: badgeText }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error setting badge text:', chrome.runtime.lastError);
    } else {
      console.log('Badge text updated:', badgeText);
    }
  });
  
  chrome.action.setBadgeBackgroundColor({ color: badgeColor }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error setting badge color:', chrome.runtime.lastError);
    } else {
      console.log('Badge color updated:', badgeColor);
    }
  });
}

// Calculate current alert count for badge updates
async function updateBadgeFromWatchlist() {
  try {
    const watchlist = await getWatchlist();
    
    let alertCount = 0;
    for (const item of Object.values(watchlist)) {
      if (item.currentPrice !== null && item.currentPrice !== undefined) {
        if ((item.lowThreshold && item.currentPrice <= item.lowThreshold) || 
            (item.highThreshold && item.currentPrice >= item.highThreshold)) {
          alertCount++;
        }
      }
    }
    
    updateBadge(alertCount);
    return alertCount;
  } catch (error) {
    console.error('Error updating badge from watchlist:', error);
    return 0;
  }
}

// Format price display
function formatPrice(price) {
  if (price >= 1000000) {
    return (price / 1000000).toFixed(1) + 'M';
  } else if (price >= 1000) {
    return (price / 1000).toFixed(1) + 'K';
  }
  return price.toString();
}

// Format price with exact numbers and commas
function formatPriceExact(price) {
  return price.toLocaleString();
}

// Default settings
const defaultSettings = {
  updateInterval: 5, // minutes
  autoRefresh: true,
  backgroundUpdates: true,
  desktopNotifications: true,
  soundAlerts: true, // Changed to true
  alertDuration: 0, // Changed to 0 (persistent until dismissed)
  notificationLimit: 10,
  priceFormat: 'gp', // Changed to 'gp' for detailed format
  sortOrder: 'date-added', // Changed to date-added
  showHistory: false,
  compactView: false,
  defaultAlertType: 'both',
  alertThreshold: 10,
  snoozeDuration: 900000,
  alertColorHigh: '#27ae60',
  alertColorLow: '#e74c3c',
  darkMode: true,
  autoRemoveDays: 0
};

// Get settings from storage
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    return { ...defaultSettings, ...(result.settings || {}) };
  } catch (error) {
    console.error('Error getting settings:', error);
    return defaultSettings;
  }
}

// Handle settings updates
async function handleSettingsUpdate(newSettings) {
  try {
    const settings = { ...defaultSettings, ...newSettings };
    
    // Update alarm interval if changed
    if (settings.updateInterval !== defaultSettings.updateInterval) {
      chrome.alarms.clear('priceCheck');
      if (settings.backgroundUpdates) {
        // Only create alarm if background updates are enabled
        chrome.alarms.create('priceCheck', { 
          delayInMinutes: 1, 
          periodInMinutes: settings.updateInterval 
        });
        console.log(`Price check interval updated to ${settings.updateInterval} minutes`);
      } else {
        console.log('Background updates disabled - no alarm created');
      }
    }
    
    // If backgroundUpdates setting changed, handle alarm accordingly
    if (newSettings.hasOwnProperty('backgroundUpdates')) {
      if (settings.backgroundUpdates) {
        // Enable background updates - create alarm
        chrome.alarms.create('priceCheck', { 
          delayInMinutes: 1, 
          periodInMinutes: settings.updateInterval 
        });
        console.log('Background updates enabled - alarm created');
      } else {
        // Disable background updates - clear alarm
        chrome.alarms.clear('priceCheck');
        console.log('Background updates disabled - alarm cleared');
      }
    }
    
    console.log('Settings updated:', settings);
  } catch (error) {
    console.error('Error handling settings update:', error);
  }
}