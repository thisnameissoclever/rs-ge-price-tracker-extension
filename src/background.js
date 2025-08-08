// Background script for RS Grand Exchange Price Tracker
console.log('Background script loaded');

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  
  // Create alarm for periodic price checking (every 5 minutes)
  chrome.alarms.create('priceCheck', { 
    delayInMinutes: 1, 
    periodInMinutes: 5 
  });
  
  // Update badge on install
  updateBadgeFromWatchlist();
});

// Update badge on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
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
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'priceCheck') {
    checkPricesAndAlert();
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
    const result = await chrome.storage.local.get(['watchlist']);
    const watchlist = result.watchlist || {};
    
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
    
    console.log('✏️ Creating watchlist entry for:', { itemId, itemName, currentPrice: itemData.currentPrice });
    
    watchlist[itemId] = {
      id: itemId,
      name: itemName,
      url: fetchUrl, // Use the clean URL for fetching
      originalUrl: itemData.url, // Keep the original URL for reference
      currentPrice: itemData.currentPrice || null,
      lowThreshold: null,
      highThreshold: null,
      lastChecked: Date.now(),
      addedAt: Date.now()
    };
    
    await chrome.storage.local.set({ watchlist });
    console.log('💾 Item saved to storage. Updated watchlist keys:', Object.keys(watchlist));
    console.log('🎯 Newly added item data:', watchlist[itemId]);
    
    // Immediately verify the save worked
    const verifyResult = await chrome.storage.local.get(['watchlist']);
    const verifiedWatchlist = verifyResult.watchlist || {};
    console.log('✅ Verification - Item exists in storage:', !!verifiedWatchlist[itemId]);
    
    console.log('Item added to watchlist:', itemName, 'with ID:', itemId);
    
    // Immediately try to fetch current price if we don't have one
    if (!itemData.currentPrice) {
      console.log('No current price available, fetching immediately...');
      const currentPrice = await fetchItemPrice(fetchUrl, itemId);
      if (currentPrice !== null) {
        watchlist[itemId].currentPrice = currentPrice;
        watchlist[itemId].lastChecked = Date.now();
        await chrome.storage.local.set({ watchlist });
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
async function getWatchlist() {
  try {
    const result = await chrome.storage.local.get(['watchlist']);
    return result.watchlist || {};
  } catch (error) {
    console.error('Error getting watchlist:', error);
    throw error;
  }
}

// Remove item from watchlist
async function removeItemFromWatchlist(itemId) {
  try {
    const result = await chrome.storage.local.get(['watchlist']);
    const watchlist = result.watchlist || {};
    
    if (watchlist[itemId]) {
      delete watchlist[itemId];
      await chrome.storage.local.set({ watchlist });
      console.log('Item removed from watchlist:', itemId);
    }
  } catch (error) {
    console.error('Error removing item from watchlist:', error);
    throw error;
  }
}

// Update item thresholds
async function updateItemThresholds(itemId, lowPrice, highPrice) {
  try {
    const result = await chrome.storage.local.get(['watchlist']);
    const watchlist = result.watchlist || {};
    
    if (watchlist[itemId]) {
      watchlist[itemId].lowThreshold = lowPrice;
      watchlist[itemId].highThreshold = highPrice;
      await chrome.storage.local.set({ watchlist });
      console.log('Thresholds updated for item:', itemId);
    }
  } catch (error) {
    console.error('Error updating thresholds:', error);
    throw error;
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
    const result = await chrome.storage.local.get(['watchlist']);
    const watchlist = result.watchlist || {};
    
    const itemIds = Object.keys(watchlist);
    console.log(`Checking prices for ${itemIds.length} items`);
    
    if (itemIds.length === 0) {
      console.log('No items to check');
      updateBadge(0); // Clear badge when no items
      return;
    }
    
    let alertCount = 0;
    let itemsToRemove = []; // Track items to auto-remove
    
    // Check each item
    for (const itemId of itemIds) {
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
          
          // Load auto-remove setting
          const autoRemoveResult = await chrome.storage.sync.get(['autoRemove']);
          const autoRemove = autoRemoveResult.autoRemove || false;
          
          if (item.lowThreshold && currentPrice <= item.lowThreshold) {
            await sendNotification(`${item.name} - LOW PRICE ALERT!`, 
              `Price dropped to ${formatPriceExact(currentPrice)} gp (threshold: ${formatPriceExact(item.lowThreshold)} gp)`,
              'low');
            notificationSent = true;
            if (autoRemove) shouldAutoRemove = true;
          }
          
          if (item.highThreshold && currentPrice >= item.highThreshold) {
            await sendNotification(`${item.name} - HIGH PRICE ALERT!`, 
              `Price rose to ${formatPriceExact(currentPrice)} gp (threshold: ${formatPriceExact(item.highThreshold)} gp)`,
              'high');
            notificationSent = true;
            if (autoRemove) shouldAutoRemove = true;
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
            
            // Load alert threshold setting
            const thresholdResult = await chrome.storage.sync.get(['alertThreshold']);
            const alertThreshold = thresholdResult.alertThreshold || 10; // Default 10%
            
            if (changePercent >= alertThreshold) {
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
    
    // Save updated watchlist (with any auto-removed items)
    await chrome.storage.local.set({ watchlist });
    
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
    
    // Fetch the item page HTML
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
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
  // Load notification settings
  const result = await chrome.storage.sync.get(['notificationDuration', 'notificationLimit', 'soundAlerts']);
  const notificationDuration = result.notificationDuration || 5; // Default 5 seconds
  const notificationLimit = result.notificationLimit || 10; // Default 10 per hour
  const soundAlerts = result.soundAlerts !== undefined ? result.soundAlerts : true; // Default true
  
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
  
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: iconUrl,
    title: title,
    message: message,
    requireInteraction: requireInteraction,
    priority: 2, // High priority
    silent: !soundAlerts // Invert soundAlerts setting for silent property
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error('Error creating notification:', chrome.runtime.lastError);
    } else {
      console.log('Notification created:', notificationId, soundAlerts ? '(with sound)' : '(silent)');
      
      // Auto-close notification after specified duration (unless persistent)
      if (notificationDuration > 0) {
        setTimeout(() => {
          chrome.notifications.clear(notificationId);
        }, notificationDuration * 1000);
      }
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
    const result = await chrome.storage.local.get(['watchlist']);
    const watchlist = result.watchlist || {};
    
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
      chrome.alarms.create('priceCheck', { 
        delayInMinutes: 1, 
        periodInMinutes: settings.updateInterval 
      });
      console.log(`Price check interval updated to ${settings.updateInterval} minutes`);
    }
    
    console.log('Settings updated:', settings);
  } catch (error) {
    console.error('Error handling settings update:', error);
  }
}