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
    console.log('🔄 Manual price refresh triggered');
    checkPricesAndAlert()
      .then(() => {
        console.log('✅ Price refresh completed, returning updated watchlist');
        // Return updated watchlist
        return getWatchlist();
      })
      .then(watchlist => {
        console.log('📤 Sending updated watchlist to popup:', Object.keys(watchlist).length, 'items');
        sendResponse({ success: true, data: watchlist });
      })
      .catch(error => {
        console.error('❌ Price refresh failed:', error);
        sendResponse({ success: false, error: error.message });
      });
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

// Simple mutex for storage operations
let storageMutex = false;

// Add item to watchlist using hybrid storage architecture
async function addItemToWatchlist(itemData) {
  // Wait for any ongoing storage operations to complete
  while (storageMutex) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  try {
    storageMutex = true; // Acquire mutex
    console.log('🔧 Background: Adding item to watchlist:', itemData);
    
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
    
    // Save metadata to sync storage
    const metadata = {
      id: itemId,
      name: itemName,
      url: fetchUrl,
      originalUrl: itemData.url,
      imageUrl: itemData.imageUrl || `https://secure.runescape.com/m=itemdb_rs/obj_big.gif?id=${itemId}`,
      lowThreshold: lowThreshold,
      highThreshold: highThreshold,
      addedAt: Date.now()
    };
    
    await saveItemMetadata(itemId, metadata);
    
    // Save initial price data to local storage if available
    if (itemData.currentPrice) {
      const priceData = {
        currentPrice: itemData.currentPrice,
        lastChecked: Date.now()
      };
      await savePriceData(itemId, priceData);
    }
    
    console.log('Item added to watchlist:', itemName, 'with ID:', itemId);
    
    // Immediately try to fetch current price if we don't have one
    if (!itemData.currentPrice) {
      console.log('No current price available, fetching immediately...');
      const priceResult = await fetchItemPrice(fetchUrl, itemId);
      if (priceResult && priceResult.currentPrice !== null) {
        const priceData = {
          currentPrice: priceResult.currentPrice,
          lastChecked: Date.now()
        };
        
        // Store price history separately in local storage
        if (priceResult.priceHistory && priceResult.priceHistory.length > 0) {
          await storePriceHistory(itemId, priceResult.priceHistory);
          
          // Store the analysis with the price data
          const analysis = analyzePriceHistory(priceResult.priceHistory);
          if (analysis) {
            priceData.priceAnalysis = analysis;
            priceData.lastHistoryUpdate = Date.now();
          }
        }
        
        await savePriceData(itemId, priceData);
        console.log('Updated price and history for newly added item:', priceResult.currentPrice);
      }
    }
    
    // Return the merged item data
    const watchlist = await getWatchlist();
    return watchlist[itemId];
  } catch (error) {
    console.error('Error adding item to watchlist:', error);
    throw error;
  } finally {
    storageMutex = false; // Always release mutex
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
    await saveSyncData({ watchlist }, 'migration');
    
    // Clear from local storage after successful migration
    await chrome.storage.local.remove(['watchlist']);
    
    console.log('✅ Successfully migrated watchlist to sync storage');
  } catch (error) {
    console.error('❌ Failed to migrate watchlist to sync storage:', error);
    throw error;
  }
}

// Price history storage management
async function storePriceHistory(itemId, priceHistory) {
  try {
    await chrome.storage.local.set({
      [`priceHistory_${itemId}`]: priceHistory
    });
    console.log(`Stored price history for item ${itemId} (${priceHistory.length} data points)`);
  } catch (error) {
    console.error(`Failed to store price history for item ${itemId}:`, error);
  }
}

async function getPriceHistory(itemId) {
  try {
    const result = await chrome.storage.local.get([`priceHistory_${itemId}`]);
    return result[`priceHistory_${itemId}`] || null;
  } catch (error) {
    console.error(`Failed to get price history for item ${itemId}:`, error);
    return null;
  }
}

async function removePriceHistory(itemId) {
  try {
    await chrome.storage.local.remove([`priceHistory_${itemId}`]);
    console.log(`Removed price history for item ${itemId}`);
  } catch (error) {
    console.error(`Failed to remove price history for item ${itemId}:`, error);
  }
}

// Get watchlist from storage (now synced across devices)
// Hybrid storage architecture:
// - Sync storage: Item metadata only (id, name, thresholds, settings)
// - Local storage: Price data, history, analysis results

// Save item metadata to sync storage (lightweight data that syncs across devices)
async function saveItemMetadata(itemId, metadata) {
  try {
    const result = await chrome.storage.sync.get(['itemMetadata']);
    const existingMetadata = result.itemMetadata || {};
    
    existingMetadata[itemId] = {
      id: itemId,
      name: metadata.name,
      url: metadata.url,
      originalUrl: metadata.originalUrl,
      imageUrl: metadata.imageUrl,
      lowThreshold: metadata.lowThreshold,
      highThreshold: metadata.highThreshold,
      addedAt: metadata.addedAt
    };
    
    await chrome.storage.sync.set({ itemMetadata: existingMetadata });
    console.log(`✅ Item metadata saved to sync storage: ${metadata.name}`);
    return true;
  } catch (error) {
    console.error('Error saving item metadata to sync storage:', error);
    throw error;
  }
}

// Get item metadata from sync storage
async function getItemMetadata() {
  try {
    const result = await chrome.storage.sync.get(['itemMetadata']);
    return result.itemMetadata || {};
  } catch (error) {
    console.error('Error getting item metadata from sync storage:', error);
    return {};
  }
}

// Save price data to local storage (heavy data that stays local)
async function savePriceData(itemId, priceData) {
  try {
    const result = await chrome.storage.local.get(['priceData']);
    const existingPriceData = result.priceData || {};
    
    existingPriceData[itemId] = {
      currentPrice: priceData.currentPrice,
      lastChecked: priceData.lastChecked,
      previousPrice: priceData.previousPrice,
      priceAnalysis: priceData.priceAnalysis,
      lastHistoryUpdate: priceData.lastHistoryUpdate,
      lastLowAlert: priceData.lastLowAlert,
      lastHighAlert: priceData.lastHighAlert,
      lastThresholdUpdate: priceData.lastThresholdUpdate
    };
    
    await chrome.storage.local.set({ priceData: existingPriceData });
    console.log(`✅ Price data saved to local storage: ${itemId}`);
  } catch (error) {
    console.error(`Error saving price data for item ${itemId}:`, error);
    throw error;
  }
}

// Get price data from local storage
async function getPriceData() {
  try {
    const result = await chrome.storage.local.get(['priceData']);
    return result.priceData || {};
  } catch (error) {
    console.error('Error getting price data from local storage:', error);
    return {};
  }
}

// Get complete watchlist by merging metadata from sync storage with price data from local storage
async function getWatchlist() {
  try {
    // Check for legacy watchlist data and migrate if needed
    const legacyResult = await chrome.storage.sync.get(['watchlist']);
    if (legacyResult.watchlist && Object.keys(legacyResult.watchlist).length > 0) {
      console.log('Migrating legacy watchlist to hybrid storage...');
      await migrateLegacyWatchlist(legacyResult.watchlist);
    }
    
    // Get item metadata from sync storage (lightweight data)
    const metadata = await getItemMetadata();
    
    // Get price data from local storage (heavy data)
    const priceData = await getPriceData();
    
    // Merge the two data sources
    const watchlist = {};
    for (const [itemId, itemMetadata] of Object.entries(metadata)) {
      const itemPriceData = priceData[itemId] || {};
      
      // Combine metadata and price data
      watchlist[itemId] = {
        ...itemMetadata,
        currentPrice: itemPriceData.currentPrice || null,
        lastChecked: itemPriceData.lastChecked || itemMetadata.addedAt || Date.now(),
        previousPrice: itemPriceData.previousPrice,
        priceAnalysis: itemPriceData.priceAnalysis,
        lastHistoryUpdate: itemPriceData.lastHistoryUpdate,
        lastLowAlert: itemPriceData.lastLowAlert,
        lastHighAlert: itemPriceData.lastHighAlert,
        lastThresholdUpdate: itemPriceData.lastThresholdUpdate
      };
    }
    
    console.log(`📊 Loaded watchlist: ${Object.keys(metadata).length} items from sync, ${Object.keys(priceData).length} price records from local`);
    return watchlist;
  } catch (error) {
    console.error('Error getting watchlist:', error);
    return {};
  }
}

// Migrate legacy watchlist to hybrid storage architecture
async function migrateLegacyWatchlist(legacyWatchlist) {
  try {
    console.log('🔄 Starting migration to hybrid storage architecture...');
    
    const metadata = {};
    const priceData = {};
    
    for (const [itemId, item] of Object.entries(legacyWatchlist)) {
      // Extract metadata for sync storage
      metadata[itemId] = {
        id: item.id,
        name: item.name,
        url: item.url,
        originalUrl: item.originalUrl,
        imageUrl: item.imageUrl,
        lowThreshold: item.lowThreshold,
        highThreshold: item.highThreshold,
        addedAt: item.addedAt
      };
      
      // Extract price data for local storage
      if (item.currentPrice !== undefined || item.lastChecked || item.priceAnalysis) {
        priceData[itemId] = {
          currentPrice: item.currentPrice,
          lastChecked: item.lastChecked,
          previousPrice: item.previousPrice,
          priceAnalysis: item.priceAnalysis,
          lastHistoryUpdate: item.lastHistoryUpdate,
          lastLowAlert: item.lastLowAlert,
          lastHighAlert: item.lastHighAlert,
          lastThresholdUpdate: item.lastThresholdUpdate
        };
      }
    }
    
    // Save to new hybrid storage
    await chrome.storage.sync.set({ itemMetadata: metadata });
    await chrome.storage.local.set({ priceData: priceData });
    
    // Clean up legacy storage
    await chrome.storage.sync.remove(['watchlist']);
    
    console.log('✅ Migration completed - metadata in sync, price data in local');
  } catch (error) {
    console.error('Error migrating legacy watchlist:', error);
  }
}



// Remove item from watchlist using hybrid storage architecture
async function removeItemFromWatchlist(itemId) {
  // Wait for any ongoing storage operations to complete
  while (storageMutex) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  try {
    storageMutex = true; // Acquire mutex
    
    // Remove from sync storage (metadata)
    const metadata = await getItemMetadata();
    if (metadata[itemId]) {
      delete metadata[itemId];
      await chrome.storage.sync.set({ itemMetadata: metadata });
      console.log('Item metadata removed from sync storage:', itemId);
    }
    
    // Remove from local storage (price data)
    const priceData = await getPriceData();
    if (priceData[itemId]) {
      delete priceData[itemId];
      await chrome.storage.local.set({ priceData: priceData });
      console.log('Item price data removed from local storage:', itemId);
    }
    
    // Also clean up price history from local storage
    await removePriceHistory(itemId);
    
    console.log('Item completely removed from watchlist:', itemId);
  } catch (error) {
    console.error('Error removing item from watchlist:', error);
    throw error;
  } finally {
    storageMutex = false; // Always release mutex
  }
}

// Update item thresholds in sync storage (metadata only)
async function updateItemThresholds(itemId, lowPrice, highPrice) {
  // Wait for any ongoing storage operations to complete
  while (storageMutex) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      storageMutex = true; // Acquire mutex
      
      // Update metadata in sync storage
      const metadata = await getItemMetadata();
      if (metadata[itemId]) {
        metadata[itemId].lowThreshold = lowPrice;
        metadata[itemId].highThreshold = highPrice;
        
        await chrome.storage.sync.set({ itemMetadata: metadata });
        console.log('Thresholds updated successfully for item:', itemId);
        
        // Also update the timestamp in price data for tracking
        const priceData = await getPriceData();
        if (priceData[itemId]) {
          priceData[itemId].lastThresholdUpdate = Date.now();
          await chrome.storage.local.set({ priceData: priceData });
        }
        
        return; // Success
      } else {
        throw new Error('Item not found in watchlist metadata');
      }
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        console.error('Error updating thresholds after retries:', error);
        throw error;
      }
      console.warn(`Threshold update attempt ${retries} failed, retrying:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 100 * retries)); // Exponential backoff
    } finally {
      storageMutex = false; // Always release mutex
    }
  }
}

// Extract item ID from RS URL
function extractItemIdFromUrl(url) {
  const match = url.match(/obj=(\d+)/);
  return match ? match[1] : null;
}

// Check prices and send alerts using hybrid storage architecture
async function checkPricesAndAlert() {
  console.groupCollapsed('🔄 Price Check Cycle');
  try {
    console.log('Starting price check cycle...');
    const watchlist = await getWatchlist();
    const settings = await getSettings();
    
    const itemIds = Object.keys(watchlist);
    console.log(`Checking prices for ${itemIds.length} items`);
    
    if (itemIds.length === 0) {
      console.log('No items to check');
      updateBadge(0); // Clear badge when no items
      console.groupEnd();
      return;
    }
    
    let alertCount = 0;
    let itemsToRemove = []; // Track items to auto-remove
    let priceUpdates = {}; // Track price updates to apply to local storage
    
    // Check for time-based auto-removal first
    if (settings.autoRemoveDays > 0) {
      const cutoffTime = Date.now() - (settings.autoRemoveDays * 24 * 60 * 60 * 1000);
      for (const itemId of itemIds) {
        const item = watchlist[itemId];
        if (item.addedAt && item.addedAt < cutoffTime) {
          console.log(`Auto-removing old item: ${item.name} (added ${Math.floor((Date.now() - item.addedAt) / (24 * 60 * 60 * 1000))} days ago)`);
          itemsToRemove.push(itemId);
        }
      }
    }
    
    // Check each item (but don't modify watchlist yet - collect updates first)
    for (const itemId of itemIds) {
      if (itemsToRemove.includes(itemId)) continue; // Skip items marked for removal
      
      const item = watchlist[itemId];
      console.groupCollapsed(`📊 ${item.name}`);
      
      // Log detailed item information for debugging
      const correctImageUrl = `https://secure.runescape.com/m=itemdb_rs/obj_big.gif?id=${itemId}`;
      const hasCorrectImageUrl = item.imageUrl === correctImageUrl;
      
      console.log('🔍 Item details:', {
        id: itemId,
        name: item.name,
        hasImageUrl: !!item.imageUrl,
        hasCorrectImageUrl: hasCorrectImageUrl,
        currentImageUrl: item.imageUrl || 'MISSING',
        expectedImageUrl: correctImageUrl,
        url: item.url,
        currentPrice: item.currentPrice
      });
      
      try {
        // Fetch current price from RS page
        const priceData = await fetchItemPrice(item.url, itemId);
        
        // Check if item is missing an image or has an incorrect/outdated image URL format
        const correctImageUrl = `https://secure.runescape.com/m=itemdb_rs/obj_big.gif?id=${itemId}`;
        const needsImageUpdate = !item.imageUrl || item.imageUrl !== correctImageUrl;
        
        if (needsImageUpdate && itemId) {
          if (!item.imageUrl) {
            console.log(`🖼️ MISSING IMAGE DETECTED for ${item.name} (ID: ${itemId})`);
          } else {
            console.log(`� OUTDATED IMAGE URL DETECTED for ${item.name} (ID: ${itemId})`);
            console.log(`   Old URL: ${item.imageUrl}`);
            console.log(`   New URL: ${correctImageUrl}`);
          }
          console.log('📝 Adding correct image URL to price updates...');
          
          // Add the image URL to the price updates to be saved later
          if (!priceUpdates[itemId]) {
            priceUpdates[itemId] = { lastChecked: Date.now() };
            console.log('📦 Created new priceUpdates entry for item');
          }
          priceUpdates[itemId].imageUrl = correctImageUrl;
          console.log(`✅ Added correct image URL for ${item.name}: ${correctImageUrl}`);
          console.log('💾 Image URL will be saved with next storage update');
        } else if (item.imageUrl === correctImageUrl) {
          console.log(`✅ Item ${item.name} already has correct image URL: ${item.imageUrl}`);
        } else {
          console.log(`⚠️ Item ${item.name} has no item ID available for image URL construction`);
        }
        
        if (priceData && priceData.currentPrice !== null && priceData.currentPrice !== item.currentPrice) {
          console.log(`Price update for ${item.name}: ${item.currentPrice} → ${priceData.currentPrice}`);
          
          // Store the price update to apply later (preserve existing updates like imageUrl)
          if (!priceUpdates[itemId]) {
            priceUpdates[itemId] = {};
          }
          Object.assign(priceUpdates[itemId], {
            currentPrice: priceData.currentPrice,
            lastChecked: Date.now(),
            previousPrice: item.currentPrice
          });
          
          // Store price history separately in local storage to avoid quota limits
          if (priceData.priceHistory && priceData.priceHistory.length > 0) {
            await storePriceHistory(itemId, priceData.priceHistory);
            
            // Store only the summarized analysis in sync storage
            const analysis = analyzePriceHistory(priceData.priceHistory);
            if (analysis) {
              priceUpdates[itemId].priceAnalysis = analysis;
              priceUpdates[itemId].lastHistoryUpdate = Date.now();
            }
          }
          
          // Check thresholds and send notifications
          let notificationSent = false;
          let shouldAutoRemove = false;
          
          if (item.lowThreshold && priceData.currentPrice <= item.lowThreshold) {
            // Check if item is snoozed
            const now = Date.now();
            if (!item.lastLowAlert || (now - item.lastLowAlert) >= settings.snoozeDuration) {
              await sendNotification(`${item.name} - LOW PRICE ALERT!`, 
                `Price dropped to ${formatPriceExact(priceData.currentPrice)} gp (threshold: ${formatPriceExact(item.lowThreshold)} gp)`,
                'low');
              notificationSent = true;
              priceUpdates[itemId].lastLowAlert = now; // Include in update
              // Auto-remove if autoRemoveDays is set to 0 (immediate removal)
              if (settings.autoRemoveDays === 0) shouldAutoRemove = true;
            } else {
              console.log(`Low alert snoozed for ${item.name} (${Math.floor((settings.snoozeDuration - (now - item.lastLowAlert)) / 60000)} minutes remaining)`);
            }
          }
          
          if (item.highThreshold && priceData.currentPrice >= item.highThreshold) {
            // Check if item is snoozed
            const now = Date.now();
            if (!item.lastHighAlert || (now - item.lastHighAlert) >= settings.snoozeDuration) {
              await sendNotification(`${item.name} - HIGH PRICE ALERT!`, 
                `Price rose to ${formatPriceExact(priceData.currentPrice)} gp (threshold: ${formatPriceExact(item.highThreshold)} gp)`,
                'high');
              notificationSent = true;
              priceUpdates[itemId].lastHighAlert = now; // Include in update
              // Auto-remove if autoRemoveDays is set to 0 (immediate removal)  
              if (settings.autoRemoveDays === 0) shouldAutoRemove = true;
            } else {
              console.log(`High alert snoozed for ${item.name} (${Math.floor((settings.snoozeDuration - (now - item.lastHighAlert)) / 60000)} minutes remaining)`);
            }
          }
          
          // Auto-remove item if threshold triggered and setting enabled
          if (shouldAutoRemove) {
            console.log(`Auto-removing item ${item.name} after threshold alert`);
            itemsToRemove.push(itemId);
          }
          
          // Also notify of significant price changes (10% or more, or custom threshold)
          if (!notificationSent && item.currentPrice && item.currentPrice > 0) {
            const changePercent = Math.abs((priceData.currentPrice - item.currentPrice) / item.currentPrice * 100);
            
            // Use settings for alert threshold
            if (changePercent >= settings.alertThreshold) {
              const direction = priceData.currentPrice > item.currentPrice ? 'increased' : 'decreased';
              await sendNotification(`${item.name} - Price Change`, 
                `Price ${direction} ${changePercent.toFixed(1)}% to ${formatPriceExact(priceData.currentPrice)} gp`,
                'change');
            }
          }
          
        } else if (priceData && priceData.currentPrice !== null) {
          // Price is the same, just update last checked time and potentially history (preserve existing updates like imageUrl)
          if (!priceUpdates[itemId]) {
            priceUpdates[itemId] = {};
          }
          Object.assign(priceUpdates[itemId], {
            lastChecked: Date.now()
          });
          
          // Update history even if price is the same
          if (priceData.priceHistory && priceData.priceHistory.length > 0) {
            await storePriceHistory(itemId, priceData.priceHistory);
            
            // Store only the summarized analysis in sync storage
            const analysis = analyzePriceHistory(priceData.priceHistory);
            if (analysis) {
              priceUpdates[itemId].priceAnalysis = analysis;
              priceUpdates[itemId].lastHistoryUpdate = Date.now();
            }
          }
          
          console.log(`Price unchanged for ${item.name}: ${formatPriceExact(priceData.currentPrice)} gp`);
        } else {
          console.log(`Failed to fetch price for ${item.name}`);
        }
        
        // Count items exceeding thresholds for badge (use current or updated price)
        const priceToCheck = priceUpdates[itemId]?.currentPrice ?? item.currentPrice;
        if (priceToCheck !== null) {
          if ((item.lowThreshold && priceToCheck <= item.lowThreshold) || 
              (item.highThreshold && priceToCheck >= item.highThreshold)) {
            alertCount++;
          }
        }
        
        // Small delay between requests to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error checking price for item ${itemId}:`, error);
      }
      console.groupEnd(); // End individual item group
    }
    
    // Update badge with alert count
    updateBadge(alertCount);
    
    // Log summary of what updates will be applied
    console.log('📋 PRICE UPDATE SUMMARY:');
    const updateSummary = Object.entries(priceUpdates).map(([itemId, updates]) => ({
      itemId,
      itemName: watchlist[itemId]?.name || 'Unknown',
      hasImageUrlUpdate: !!updates.imageUrl,
      hasPriceUpdate: updates.currentPrice !== undefined,
      currentImageUrl: watchlist[itemId]?.imageUrl || 'NONE',
      newImageUrl: updates.imageUrl || 'NO UPDATE',
      updates: Object.keys(updates)
    }));
    console.table(updateSummary);
    
    // Now apply all updates atomically with mutex protection
    await applyPriceUpdatesAtomically(priceUpdates, itemsToRemove);
    
    if (itemsToRemove.length > 0) {
      console.log(`Price check cycle completed. ${itemsToRemove.length} items auto-removed, ${alertCount} remaining items have alerts.`);
    } else {
      console.log(`Price check cycle completed, watchlist updated. ${alertCount} items have alerts.`);
    }
    
  } catch (error) {
    console.error('Error in checkPricesAndAlert:', error);
  }
  console.groupEnd(); // End main price check cycle group
}

// Apply price updates atomically using hybrid storage architecture
async function applyPriceUpdatesAtomically(priceUpdates, itemsToRemove) {
  // Wait for any ongoing storage operations to complete
  while (storageMutex) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  try {
    storageMutex = true; // Acquire mutex
    
    console.log('📦 Applying price updates to hybrid storage:', Object.keys(priceUpdates).length, 'items');
    
    // Get current data from both storage locations
    const metadata = await getItemMetadata();
    const priceData = await getPriceData();
    
    // Apply updates to appropriate storage
    for (const [itemId, updates] of Object.entries(priceUpdates)) {
      // Update metadata in sync storage if needed (like imageUrl)
      if (metadata[itemId] && updates.imageUrl) {
        console.log(`🖼️ Updating image URL in sync storage for ${metadata[itemId].name}: ${updates.imageUrl}`);
        metadata[itemId].imageUrl = updates.imageUrl;
      }
      
      // Update price data in local storage
      if (!priceData[itemId]) {
        priceData[itemId] = {};
      }
      
      // Apply all price-related updates to local storage
      const priceUpdate = { ...updates };
      delete priceUpdate.imageUrl; // This goes to sync storage, not local
      
      Object.assign(priceData[itemId], priceUpdate);
      
      if (updates.imageUrl) {
        console.log(`✅ Image URL will be saved to sync storage for ${metadata[itemId]?.name}`);
      }
      console.log(`📊 Price data updated for ${metadata[itemId]?.name || itemId}`);
    }
    
    // Remove items marked for removal from both storage locations
    for (const itemId of itemsToRemove) {
      if (metadata[itemId]) {
        console.log(`Removing item from sync storage: ${metadata[itemId].name}`);
        delete metadata[itemId];
      }
      
      if (priceData[itemId]) {
        console.log(`Removing price data from local storage: ${itemId}`);
        delete priceData[itemId];
      }
      
      // Also clean up price history from local storage
      await removePriceHistory(itemId);
    }
    
    // Save updates to both storage locations
    console.log('💾 Saving updates to hybrid storage...');
    await chrome.storage.sync.set({ itemMetadata: metadata });
    await chrome.storage.local.set({ priceData: priceData });
    
    console.log('✅ Price updates and removals applied successfully to hybrid storage');
    
    // Log final state
    console.log('📋 FINAL HYBRID STORAGE STATE:');
    console.log(`  Sync storage: ${Object.keys(metadata).length} item metadata records`);
    console.log(`  Local storage: ${Object.keys(priceData).length} price data records`);
    
  } catch (error) {
    console.error('Error applying price updates atomically:', error);
  } finally {
    storageMutex = false; // Always release mutex
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
    let priceHistory = null;
    
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
    
    // Extract price history from JavaScript data - look for the average30 arrays
    try {
      // Look for average30.push patterns which contain the historical price data
      const average30Matches = html.match(/average30\.push\(\[new Date\([^,]+\),\s*(\d+),\s*\d+\]\);?/g);
      
      if (average30Matches && average30Matches.length > 0) {
        // Parse all historical data points
        priceHistory = [];
        average30Matches.forEach(match => {
          const fullMatch = match.match(/average30\.push\(\[new Date\(([^,]+)\),\s*(\d+),\s*(\d+)\]\);?/);
          if (fullMatch) {
            const dateStr = fullMatch[1].replace(/['"]/g, ''); // Remove quotes
            const price = parseInt(fullMatch[2]);
            const volume = parseInt(fullMatch[3]);
            
            priceHistory.push({
              date: dateStr,
              price: price,
              volume: volume,
              timestamp: new Date(dateStr).getTime()
            });
          }
        });
        
        // Get current price from the most recent data point
        if (priceHistory.length > 0) {
          currentPrice = priceHistory[priceHistory.length - 1].price;
          console.log(`Found ${priceHistory.length} days of price history, current price from data:`, currentPrice);
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
    
    console.log(`Final extracted data for item ${itemId}:`, { itemName, currentPrice, historyPoints: priceHistory?.length || 0 });
    
    // Return both current price and price history
    return {
      currentPrice,
      priceHistory
    };
    
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

// Analyze price history and generate trend information
function analyzePriceHistory(priceHistory) {
  if (!priceHistory || priceHistory.length === 0) {
    return null;
  }
  
  const prices = priceHistory.map(p => p.price);
  const currentPrice = prices[prices.length - 1];
  const oldestPrice = prices[0];
  
  // Calculate statistics
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  
  // Calculate trend (comparing current to 7 days ago if available)
  const sevenDaysAgo = Math.max(0, prices.length - 7);
  const weekAgoPrice = prices[sevenDaysAgo];
  const weeklyChange = currentPrice - weekAgoPrice;
  const weeklyChangePercent = weekAgoPrice > 0 ? (weeklyChange / weekAgoPrice * 100) : 0;
  
  // Calculate daily trend (comparing current to 1 day ago if available)
  const oneDayAgo = Math.max(0, prices.length - 2); // Second to last entry is 1 day ago
  const dayAgoPrice = prices[oneDayAgo];
  const dailyChange = currentPrice - dayAgoPrice;
  const dailyChangePercent = dayAgoPrice > 0 ? (dailyChange / dayAgoPrice * 100) : 0;
  
  // Calculate overall trend (current vs oldest)
  const overallChange = currentPrice - oldestPrice;
  const overallChangePercent = oldestPrice > 0 ? (overallChange / oldestPrice * 100) : 0;
  
  // Determine trend direction
  let trendDirection = 'stable';
  let trendEmoji = '➡️';
  
  if (Math.abs(weeklyChangePercent) > 2) { // More than 2% change in a week
    if (weeklyChangePercent > 0) {
      trendDirection = 'rising';
      trendEmoji = '📈';
    } else {
      trendDirection = 'falling';
      trendEmoji = '📉';
    }
  }
  
  // Calculate volatility (standard deviation as percentage of mean)
  const variance = prices.reduce((acc, price) => acc + Math.pow(price - avgPrice, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const volatility = avgPrice > 0 ? (stdDev / avgPrice * 100) : 0;

  // Categorize volatility (adjusted for RuneScape market behavior)
  let volatilityCategory = 'Low';
  let volatilityEmoji = '📱';
  if (volatility > 8) {
    volatilityCategory = 'High';
    volatilityEmoji = '🔥';
  } else if (volatility > 3) {
    volatilityCategory = 'Moderate';
    volatilityEmoji = '📊';
  }

  // Advanced positioning metrics
  const range = maxPrice - minPrice;
  const rangePosition = range > 0 ? ((currentPrice - minPrice) / range * 100) : 50; // 0=at min, 100=at max
  const zScore = stdDev > 0 ? ((currentPrice - avgPrice) / stdDev) : 0;
  // Percentile rank of current price within the window
  let less = 0, equal = 0;
  for (const v of prices) {
    if (v < currentPrice) less++; else if (v === currentPrice) equal++;
  }
  const percentileRank = prices.length > 0 ? ((less + 0.5 * equal) / prices.length) * 100 : 50;

  // Calculate trading signal
  const currentVsAvgPct = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
  let tradingSignal = 'Price in normal range';
  let tradingSignalClass = 'neutral';
  
  if (currentVsAvgPct < -10 && rangePosition < 30) {
    tradingSignal = 'Good buy opportunity';
    tradingSignalClass = 'positive';
  } else if (currentVsAvgPct > 10 && rangePosition > 70) {
    tradingSignal = 'Good sell opportunity';
    tradingSignalClass = 'negative';
  } else if (currentVsAvgPct < -5) {
    tradingSignal = 'Below average - consider buying';
    tradingSignalClass = 'neutral';
  } else if (currentVsAvgPct > 5) {
    tradingSignal = 'Above average - consider selling';
    tradingSignalClass = 'neutral';
  }

  // Determine position status
  let positionStatus = 'Price in normal range';
  if (rangePosition >= 90) {
    positionStatus = 'At recent high';
  } else if (rangePosition <= 10) {
    positionStatus = 'At recent low';
  } else if (rangePosition >= 70) {
    positionStatus = 'Near recent high';
  } else if (rangePosition <= 30) {
    positionStatus = 'Near recent low';
  }
  
  return {
    currentPrice,
    minPrice,
    maxPrice,
    avgPrice,
    weeklyChange,
    weeklyChangePercent,
    dailyChange,
    dailyChangePercent,
    trendDirection,
    trendEmoji,
    dataPoints: prices.length,
    priceRange: maxPrice - minPrice,
    priceRangePercent: minPrice > 0 ? ((maxPrice - minPrice) / minPrice * 100) : 0,
    volatility,
    volatilityCategory,
    volatilityEmoji,
    rangePosition,
    zScore,
    percentileRank,
    tradingSignal,
    tradingSignalClass,
    positionStatus
  };
}

// Default settings
const defaultSettings = {
  updateInterval: 5, // minutes
  autoRefresh: false,
  backgroundUpdates: true,
  desktopNotifications: true,
  soundAlerts: true, // Changed to true
  alertDuration: 0, // Changed to 0 (persistent until dismissed)
  notificationLimit: 10,
  priceFormat: 'gp', // Changed to 'gp' for detailed format
  sortOrder: 'date-added', // Changed to date-added
  showHistory: true,
  chartHistoryDays: 14, // Default to 14 days for chart history
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