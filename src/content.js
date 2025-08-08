// Content script for RS Grand Exchange item pages
console.log('RS GE Price Tracker content script loaded');

// Check if we're on an item page
if (window.location.href.includes('/m=itemdb_rs/') && window.location.href.includes('viewitem')) {
  console.log('RS GE Price Tracker: Detected item page -', window.location.href);
  initializeItemPage();
} else {
  console.log('RS GE Price Tracker: Not on an item page -', window.location.href);
}

function initializeItemPage() {
  // Wait for page to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupItemTracking);
  } else {
    setupItemTracking();
  }
}

function setupItemTracking() {
  try {
    console.log('Setting up item tracking on page:', window.location.href);
    
    // Wait a bit for dynamic content to load
    setTimeout(() => {
      const itemData = extractItemData();
      
      if (itemData) {
        console.log('✅ Item data extracted successfully:', itemData);
        
        // Add a button to track this item
        addTrackingButton(itemData);
        
        // Also make the data available globally for debugging
        window.rsTrackerItemData = itemData;
        console.log('💡 Debug: Item data available at window.rsTrackerItemData');
        
        // Listen for extension icon clicks (when popup opens)
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message.action === 'getPageItemData') {
            // Re-extract data in case page has updated
            const currentData = extractItemData();
            console.log('🔄 Re-extracted data for popup:', currentData);
            sendResponse({ success: true, data: currentData || itemData });
          }
        });
        
      } else {
        console.log('❌ Could not extract item data from page - retrying in 2 seconds...');
        // Retry after 2 seconds in case page is still loading
        setTimeout(() => {
          const retryData = extractItemData();
          if (retryData) {
            console.log('✅ Item data extracted on retry:', retryData);
            addTrackingButton(retryData);
            window.rsTrackerItemData = retryData;
            
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
              if (message.action === 'getPageItemData') {
                const currentData = extractItemData();
                sendResponse({ success: true, data: currentData || retryData });
              }
            });
          } else {
            console.log('❌ Still could not extract item data after retry');
            console.log('🔍 Debug info:');
            console.log('- Page title:', document.title);
            console.log('- URL:', window.location.href);
            console.log('- Page text (first 500 chars):', document.body.textContent.substring(0, 500));
          }
        }, 2000);
      }
    }, 1000); // Initial delay to let page load
    
  } catch (error) {
    console.error('Error setting up item tracking:', error);
  }
}

function extractItemData() {
  try {
    console.log('Extracting item data from page...');
    
    // Extract item ID from URL - this is the most reliable method
    const urlMatch = window.location.href.match(/obj=(\d+)/);
    const itemId = urlMatch ? urlMatch[1] : null;
    console.log('Extracted item ID:', itemId);
    
    if (!itemId) {
      console.log('No item ID found in URL');
      return null;
    }
    
    // Extract item name from page title - most reliable source
    let itemName = '';
    const title = document.title;
    
    // Parse title like "Terrasaur maul - Grand Exchange - RuneScape"
    const titleMatch = title.match(/^([^-]+)\s*-\s*Grand Exchange/);
    if (titleMatch) {
      itemName = titleMatch[1].trim();
      console.log('Extracted item name from title:', itemName);
    }
    
    // Fallback: try meta description or URL path
    if (!itemName) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && metaDesc.content) {
        console.log('Trying meta description for name...');
      }
      
      // Extract from URL path as last resort
      const urlPath = window.location.pathname;
      const pathMatch = urlPath.match(/\/m=itemdb_rs\/([^\/]+)\//);
      if (pathMatch) {
        itemName = decodeURIComponent(pathMatch[1]).replace(/\+/g, ' ');
        console.log('Extracted item name from URL path:', itemName);
      }
    }
    
    // Extract current price from JavaScript data
    let currentPrice = null;
    
    try {
      // Look for price data in script content
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || script.innerHTML;
        
        // Look for average30 data which contains current prices
        const average30Match = content.match(/average30\.push\(\[new Date\([^,]+\),\s*(\d+),\s*\d+\]\)/g);
        if (average30Match && average30Match.length > 0) {
          // Get the last (most recent) price entry
          const lastMatch = average30Match[average30Match.length - 1];
          const priceMatch = lastMatch.match(/,\s*(\d+),/);
          if (priceMatch) {
            currentPrice = parseInt(priceMatch[1]);
            console.log('Found price from JavaScript data:', currentPrice);
            break;
          }
        }
        
        // Also look for simpler patterns if the above doesn't work
        if (!currentPrice) {
          const simplePriceMatch = content.match(/(\d{6,})/g); // Look for large numbers
          if (simplePriceMatch) {
            // Take the first reasonable price (between 1000 and 10 billion)
            for (const match of simplePriceMatch) {
              const price = parseInt(match);
              if (price >= 1000 && price <= 10000000000) {
                currentPrice = price;
                console.log('Found price from simple pattern:', currentPrice);
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing script content for price:', error);
    }
    
    // If we still don't have a price, try to find it in visible text
    if (!currentPrice) {
      console.log('Trying to find price in visible text...');
      const bodyText = document.body.textContent || '';
      
      // Look for "Current Guide Price" followed by numbers
      const currentGuideMatch = bodyText.match(/Current\s+Guide\s+Price[:\s]*([0-9,.]+)/i);
      if (currentGuideMatch) {
        const priceStr = currentGuideMatch[1].replace(/[,\s]/g, '');
        const price = parseInt(priceStr);
        if (price > 0) {
          currentPrice = price;
          console.log('Found price from "Current Guide Price":', currentPrice);
        }
      }
    }
    
    console.log('Final extracted data:', { itemId, itemName, currentPrice });
    
    if (!itemName || !itemId) {
      console.log('Missing required item data - name:', itemName, 'id:', itemId);
      return null;
    }
    
    return {
      id: itemId,
      name: itemName,
      url: window.location.href,
      currentPrice: currentPrice
    };
    
  } catch (error) {
    console.error('Error extracting item data:', error);
    return null;
  }
}

function addTrackingButton(itemData) {
  // Remove existing button if present
  const existingButton = document.getElementById('rs-tracker-btn');
  if (existingButton) {
    existingButton.remove();
  }
  
  // Try to detect header height dynamically
  let headerHeight = 120; // Default fallback
  
  // Look for common header elements on the RuneScape site
  const potentialHeaders = [
    document.querySelector('header'),
    document.querySelector('.header'),
    document.querySelector('#header'),
    document.querySelector('.top-nav'),
    document.querySelector('.navigation'),
    document.querySelector('[class*="header"]')
  ].filter(Boolean);
  
  if (potentialHeaders.length > 0) {
    const header = potentialHeaders[0];
    const headerRect = header.getBoundingClientRect();
    if (headerRect.height > 0 && headerRect.height < 300) {
      headerHeight = Math.ceil(headerRect.height + 10); // Add 10px padding
      console.log('Detected header height:', headerHeight);
    }
  }
  
  // Create tracking button
  const button = document.createElement('button');
  button.id = 'rs-tracker-btn';
  button.innerHTML = '📈 Track this item';
  button.style.cssText = `
    position: fixed;
    top: ${headerHeight}px;
    right: 10px;
    z-index: 10000;
    padding: 10px 15px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    transition: background 0.3s;
  `;
  
  button.addEventListener('mouseenter', () => {
    button.style.background = '#45a049';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.background = '#4CAF50';
  });
  
  button.addEventListener('click', () => {
    addItemToTracker(itemData, button);
  });
  
  document.body.appendChild(button);
}

function addItemToTracker(itemData, button) {
  // Show loading state
  button.innerHTML = '⏳ Adding...';
  button.disabled = true;
  
  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'addItem',
    itemData: itemData
  }, (response) => {
    if (response && response.success) {
      // Success
      button.innerHTML = '✅ Tracked!';
      button.style.background = '#2196F3';
      
      // Show success message
      showMessage('Item added to your watchlist!', 'success');
      
      // Reset button after 3 seconds
      setTimeout(() => {
        button.innerHTML = '📈 Track this item';
        button.style.background = '#4CAF50';
        button.disabled = false;
      }, 3000);
      
    } else {
      // Error
      button.innerHTML = '❌ Error';
      button.style.background = '#f44336';
      
      const errorMsg = response ? response.error : 'Unknown error';
      showMessage('Error adding item: ' + errorMsg, 'error');
      
      // Reset button after 3 seconds
      setTimeout(() => {
        button.innerHTML = '📈 Track this item';
        button.style.background = '#4CAF50';
        button.disabled = false;
      }, 3000);
    }
  });
}

function showMessage(text, type = 'info') {
  // Remove existing messages
  const existingMsg = document.getElementById('rs-tracker-message');
  if (existingMsg) {
    existingMsg.remove();
  }
  
  // Calculate message position based on button position
  const trackButton = document.getElementById('rs-tracker-btn');
  let messageTop = 170; // Default fallback
  
  if (trackButton) {
    const buttonRect = trackButton.getBoundingClientRect();
    messageTop = buttonRect.bottom + 10; // Position message below button with 10px gap
  }
  
  // Create message element
  const message = document.createElement('div');
  message.id = 'rs-tracker-message';
  message.textContent = text;
  
  const bgColor = type === 'success' ? '#4CAF50' : 
                 type === 'error' ? '#f44336' : '#2196F3';
  
  message.style.cssText = `
    position: fixed;
    top: ${messageTop}px;
    right: 10px;
    z-index: 10001;
    padding: 10px 15px;
    background: ${bgColor};
    color: white;
    border-radius: 5px;
    font-size: 14px;
    max-width: 250px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
  `;
  
  // Add CSS animation
  if (!document.getElementById('rs-tracker-styles')) {
    const style = document.createElement('style');
    style.id = 'rs-tracker-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(message);
  
  // Auto remove after 4 seconds
  setTimeout(() => {
    if (message.parentNode) {
      message.remove();
    }
  }, 4000);
}