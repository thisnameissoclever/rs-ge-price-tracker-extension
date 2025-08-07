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
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  
  if (message.action === 'addItem') {
    addItemToWatchlist(message.itemData)
      .then(result => sendResponse({ success: true, data: result }))
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
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'updateThresholds') {
    updateItemThresholds(message.itemId, message.lowPrice, message.highPrice)
      .then(() => sendResponse({ success: true }))
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
});

// Handle alarms for periodic price checking
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'priceCheck') {
    checkPricesAndAlert();
  }
});

// Add item to watchlist
async function addItemToWatchlist(itemData) {
  try {
    const result = await chrome.storage.local.get(['watchlist']);
    const watchlist = result.watchlist || {};
    
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
      return;
    }
    
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
          
          if (item.lowThreshold && currentPrice <= item.lowThreshold) {
            sendNotification(`${item.name} - LOW PRICE ALERT!`, 
              `Price dropped to ${formatPriceExact(currentPrice)} gp (threshold: ${formatPriceExact(item.lowThreshold)} gp)`);
            notificationSent = true;
          }
          
          if (item.highThreshold && currentPrice >= item.highThreshold) {
            sendNotification(`${item.name} - HIGH PRICE ALERT!`, 
              `Price rose to ${formatPriceExact(currentPrice)} gp (threshold: ${formatPriceExact(item.highThreshold)} gp)`);
            notificationSent = true;
          }
          
          // Also notify of significant price changes (10% or more)
          if (!notificationSent && previousPrice && previousPrice > 0) {
            const changePercent = Math.abs((currentPrice - previousPrice) / previousPrice * 100);
            if (changePercent >= 10) {
              const direction = currentPrice > previousPrice ? 'increased' : 'decreased';
              sendNotification(`${item.name} - Price Change`, 
                `Price ${direction} ${changePercent.toFixed(1)}% to ${formatPriceExact(currentPrice)} gp`);
            }
          }
          
        } else if (currentPrice !== null) {
          // Price is the same, just update last checked time
          item.lastChecked = Date.now();
          console.log(`Price unchanged for ${item.name}: ${formatPriceExact(currentPrice)} gp`);
        } else {
          console.log(`Failed to fetch price for ${item.name}`);
        }
        
        // Small delay between requests to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error checking price for item ${itemId}:`, error);
      }
    }
    
    // Save updated watchlist
    await chrome.storage.local.set({ watchlist });
    console.log('Price check cycle completed, watchlist updated');
    
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

// Send notification
function sendNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: title,
    message: message
  });
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