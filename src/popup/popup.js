// Popup script for RS Grand Exchange Price Tracker
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded');
    
    // Initialize popup
    initializePopup();
});

async function initializePopup() {
    try {
        // Check if current tab is an RS item page
        await checkCurrentPage();
        
        // Load and display watchlist
        await loadWatchlist();
        
        // Auto-refresh prices when popup opens
        setTimeout(() => {
            autoRefreshPrices();
        }, 500); // Small delay to let UI load first
        
        // Add refresh button event listener
        const refreshBtn = document.getElementById('refresh-prices-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshPrices);
        }
        
    } catch (error) {
        console.error('Error initializing popup:', error);
        showError('Failed to initialize extension');
    }
}

async function checkCurrentPage() {
    try {
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.url && tab.url.includes('secure.runescape.com/m=itemdb_rs/') && tab.url.includes('viewitem')) {
            // We're on an RS item page
            console.log('On RS item page');
            
            // Try to get item data from content script
            chrome.tabs.sendMessage(tab.id, { action: 'getPageItemData' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Content script not ready or not on item page');
                    return;
                }
                
                if (response && response.success && response.data) {
                    showCurrentPageSection(response.data);
                }
            });
        }
    } catch (error) {
        console.error('Error checking current page:', error);
    }
}

function showCurrentPageSection(itemData) {
    const section = document.getElementById('current-page-section');
    const infoDiv = document.getElementById('current-item-info');
    const addBtn = document.getElementById('add-current-btn');
    
    infoDiv.innerHTML = `
        <strong>${itemData.name}</strong><br>
        ${itemData.currentPrice ? `Current Price: ${formatPriceExact(itemData.currentPrice)} gp` : 'Price: Unknown'}
    `;
    
    // Show the section
    section.classList.remove('hidden');
    
    // Handle add button click
    addBtn.removeEventListener('click', addCurrentItem); // Remove any existing listener
    addBtn.addEventListener('click', () => addCurrentItem(itemData));
}

async function addCurrentItem(itemData) {
    const addBtn = document.getElementById('add-current-btn');
    
    try {
        addBtn.textContent = 'Adding...';
        addBtn.disabled = true;
        
        // Send message to background script
        const response = await sendMessage({ action: 'addItem', itemData });
        
        if (response.success) {
            addBtn.textContent = 'Added!';
            addBtn.style.background = '#4CAF50';
            
            // Reload watchlist to show the new item
            setTimeout(() => {
                loadWatchlist();
                addBtn.textContent = 'Add to Watchlist';
                addBtn.style.background = '';
                addBtn.disabled = false;
            }, 1500);
            
        } else {
            throw new Error(response.error || 'Failed to add item');
        }
        
    } catch (error) {
        console.error('Error adding item:', error);
        showError('Failed to add item: ' + error.message);
        
        addBtn.textContent = 'Add to Watchlist';
        addBtn.disabled = false;
    }
}

async function loadWatchlist() {
    const container = document.getElementById('watchlist-container');
    
    try {
        // Get watchlist from background script
        const response = await sendMessage({ action: 'getWatchlist' });
        
        if (response.success) {
            const watchlist = response.data;
            displayWatchlist(watchlist);
        } else {
            throw new Error(response.error || 'Failed to load watchlist');
        }
        
    } catch (error) {
        console.error('Error loading watchlist:', error);
        container.innerHTML = '<div class="error">Failed to load watchlist</div>';
    }
}

async function autoRefreshPrices() {
    const indicator = document.getElementById('auto-refresh-indicator');
    const container = document.getElementById('watchlist-container');
    
    try {
        // Show spinner indicator
        indicator.classList.add('visible');
        
        // Trigger price refresh
        const response = await sendMessage({ action: 'refreshPrices' });
        
        if (response.success && response.data && response.data.length > 0) {
            // Only update if we have items to show
            displayWatchlist(response.data);
        }
        
    } catch (error) {
        console.error('Auto-refresh error:', error);
        // Don't show error for auto-refresh, just log it
    } finally {
        // Hide spinner after refresh completes
        setTimeout(() => {
            indicator.classList.remove('visible');
        }, 500); // Small delay so user can see it completed
    }
}

async function refreshPrices() {
    const refreshBtn = document.getElementById('refresh-prices-btn');
    const indicator = document.getElementById('auto-refresh-indicator');
    const container = document.getElementById('watchlist-container');
    
    try {
        // Show loading state on button and spinner
        const originalText = refreshBtn.textContent;
        refreshBtn.textContent = '🔄 Refreshing...';
        refreshBtn.disabled = true;
        indicator.classList.add('visible');
        
        // Trigger price refresh
        const response = await sendMessage({ action: 'refreshPrices' });
        
        if (response.success) {
            // Display updated watchlist
            displayWatchlist(response.data);
            refreshBtn.textContent = '✅ Updated!';
            
            // Reset button after 2 seconds
            setTimeout(() => {
                refreshBtn.textContent = originalText;
                refreshBtn.disabled = false;
            }, 2000);
        } else {
            throw new Error(response.error || 'Failed to refresh prices');
        }
        
    } catch (error) {
        console.error('Error refreshing prices:', error);
        showError('Failed to refresh prices: ' + error.message);
        
        refreshBtn.textContent = '🔄 Refresh Prices';
        refreshBtn.disabled = false;
    } finally {
        // Hide spinner
        setTimeout(() => {
            indicator.classList.remove('visible');
        }, 500);
    }
}

function displayWatchlist(watchlist) {
    const container = document.getElementById('watchlist-container');
    
    const items = Object.values(watchlist);
    
    if (items.length === 0) {
        container.innerHTML = `
            <div class="watchlist-empty">
                No items in your watchlist yet.<br>
                Visit a RuneScape Grand Exchange item page and click "Track this item" or the extension icon to add items.
            </div>
        `;
        return;
    }
    
    // Sort items by name
    items.sort((a, b) => a.name.localeCompare(b.name));
    
    container.innerHTML = items.map(item => createItemHTML(item)).join('');
    
    // Add event listeners
    items.forEach(item => {
        // Remove button
        const removeBtn = document.getElementById(`remove-${item.id}`);
        if (removeBtn) {
            removeBtn.addEventListener('click', () => removeItem(item.id));
        }
        
        // Update button
        const updateBtn = document.getElementById(`update-${item.id}`);
        if (updateBtn) {
            updateBtn.addEventListener('click', () => updateThresholds(item.id));
        }
    });
}

function createItemHTML(item) {
    const lastChecked = item.lastChecked ? 
        new Date(item.lastChecked).toLocaleString() : 'Never';
    
    const addedAt = item.addedAt ? 
        new Date(item.addedAt).toLocaleDateString() : 'Unknown';
        
    // Calculate time since last check
    let timeSinceCheck = 'Never';
    if (item.lastChecked) {
        const timeDiff = Date.now() - item.lastChecked;
        const minutes = Math.floor(timeDiff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            timeSinceCheck = `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            timeSinceCheck = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            timeSinceCheck = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            timeSinceCheck = 'Just now';
        }
    }
    
    // Determine alert status and colors
    let alertStatus = 'normal';
    let alertIndicator = '';
    
    if (item.currentPrice && item.lowThreshold && item.currentPrice <= item.lowThreshold) {
        alertStatus = 'low';
        alertIndicator = '<span class="alert-indicator-low">🔻 LOW</span>';
    } else if (item.currentPrice && item.highThreshold && item.currentPrice >= item.highThreshold) {
        alertStatus = 'high';
        alertIndicator = '<span class="alert-indicator-high">🔺 HIGH</span>';
    }
    
    const itemClass = alertStatus === 'low' ? 'item-low-alert' : 
                      alertStatus === 'high' ? 'item-high-alert' : 'item-normal';
    
    return `
        <div class="item ${itemClass}" data-item-id="${item.id}" data-alert-status="${alertStatus}">
            <div class="item-header">
                <div class="item-name" title="${escapeHtml(item.name)}">
                    <a href="https://secure.runescape.com/m=itemdb_rs/viewitem?obj=${item.id}" 
                       target="_blank" 
                       class="item-link ${alertStatus !== 'normal' ? 'item-link-alert' : ''}">
                        ${escapeHtml(item.name)}
                    </a>
                    ${alertIndicator}
                </div>
                <button id="remove-${item.id}" class="remove-btn" title="Remove from watchlist">×</button>
            </div>
            <div class="item-price">
                <span class="current-price ${alertStatus !== 'normal' ? 'current-price-alert' : ''}">
                    Current Price: <strong>${item.currentPrice ? formatPriceExact(item.currentPrice) + ' gp' : 'Unknown'}</strong>
                </span>
                ${item.currentPrice ? `<small class="time-since ${alertStatus !== 'normal' ? 'time-since-alert' : ''}">${timeSinceCheck}</small>` : ''}
            </div>
            <div class="thresholds">
                <div class="threshold-group">
                    <label class="${alertStatus === 'low' ? 'threshold-label-low' : 'threshold-label'}">Low Alert (≤)</label>
                    <input type="number" id="low-${item.id}" placeholder="e.g. 1000" 
                           value="${item.lowThreshold || ''}" min="0"
                           class="threshold-input ${alertStatus !== 'normal' ? 'threshold-input-alert' : ''}">
                </div>
                <div class="threshold-group">
                    <label class="${alertStatus === 'high' ? 'threshold-label-high' : 'threshold-label'}">High Alert (≥)</label>
                    <input type="number" id="high-${item.id}" placeholder="e.g. 5000" 
                           value="${item.highThreshold || ''}" min="0"
                           class="threshold-input ${alertStatus !== 'normal' ? 'threshold-input-alert' : ''}">
                </div>
                <button id="update-${item.id}" class="update-btn ${alertStatus !== 'normal' ? 'update-btn-alert' : ''} ${alertStatus === 'low' ? 'update-btn-low' : alertStatus === 'high' ? 'update-btn-high' : ''}">
                    Update Alerts
                </button>
            </div>
            <div class="last-checked ${alertStatus !== 'normal' ? 'last-checked-alert' : ''}">
                <span>Added: ${addedAt}</span>
                <span>Last checked: ${lastChecked}</span>
            </div>
        </div>
    `;
}

function refreshSingleItem(updatedItem) {
    // Find the existing item element
    const existingItemElement = document.querySelector(`[data-item-id="${updatedItem.id}"]`);
    if (!existingItemElement) {
        console.log('Item element not found for refresh:', updatedItem.id);
        return;
    }
    
    // Create new HTML for the item
    const newItemHTML = createItemHTML(updatedItem);
    
    // Create a temporary container to parse the new HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newItemHTML;
    const newItemElement = tempDiv.firstElementChild;
    
    // Replace the old element with the new one
    existingItemElement.parentNode.replaceChild(newItemElement, existingItemElement);
    
    // Re-attach event listeners for this specific item
    const removeBtn = document.getElementById(`remove-${updatedItem.id}`);
    if (removeBtn) {
        removeBtn.addEventListener('click', () => removeItem(updatedItem.id));
    }
    
    const updateBtn = document.getElementById(`update-${updatedItem.id}`);
    if (updateBtn) {
        updateBtn.addEventListener('click', () => updateThresholds(updatedItem.id));
    }
    
    console.log('Refreshed single item display:', updatedItem.name);
}

async function removeItem(itemId) {
    try {
        const response = await sendMessage({ action: 'removeItem', itemId });
        
        if (response.success) {
            // Reload watchlist
            await loadWatchlist();
        } else {
            throw new Error(response.error || 'Failed to remove item');
        }
        
    } catch (error) {
        console.error('Error removing item:', error);
        showError('Failed to remove item');
    }
}

async function updateThresholds(itemId) {
    const lowInput = document.getElementById(`low-${itemId}`);
    const highInput = document.getElementById(`high-${itemId}`);
    const updateBtn = document.getElementById(`update-${itemId}`);
    
    try {
        const lowPrice = lowInput.value ? parseFloat(lowInput.value) : null;
        const highPrice = highInput.value ? parseFloat(highInput.value) : null;
        
        // Validate inputs
        if (lowPrice !== null && (lowPrice < 0 || isNaN(lowPrice))) {
            showError('Low price must be a valid positive number');
            return;
        }
        
        if (highPrice !== null && (highPrice < 0 || isNaN(highPrice))) {
            showError('High price must be a valid positive number');
            return;
        }
        
        if (lowPrice !== null && highPrice !== null && lowPrice >= highPrice) {
            showError('Low price must be less than high price');
            return;
        }
        
        updateBtn.textContent = 'Updating...';
        updateBtn.disabled = true;
        
        const response = await sendMessage({ 
            action: 'updateThresholds', 
            itemId, 
            lowPrice, 
            highPrice 
        });
        
        if (response.success) {
            updateBtn.textContent = 'Updated!';
            updateBtn.style.background = '#4CAF50';
            
            // Get the updated item data and refresh its appearance immediately
            const updatedItemResponse = await sendMessage({ action: 'getWatchlist' });
            if (updatedItemResponse.success) {
                const updatedItem = updatedItemResponse.data[itemId];
                if (updatedItem) {
                    refreshSingleItem(updatedItem);
                }
            }
            
            setTimeout(() => {
                updateBtn.textContent = 'Update Alerts';
                updateBtn.style.background = '';
                updateBtn.disabled = false;
            }, 1500);
            
        } else {
            throw new Error(response.error || 'Failed to update thresholds');
        }
        
    } catch (error) {
        console.error('Error updating thresholds:', error);
        showError('Failed to update alerts: ' + error.message);
        
        updateBtn.textContent = 'Update Alerts';
        updateBtn.disabled = false;
    }
}

// Utility functions
function sendMessage(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, resolve);
    });
}

function formatPrice(price) {
    if (price >= 1000000) {
        return (price / 1000000).toFixed(1) + 'M';
    } else if (price >= 1000) {
        return (price / 1000).toFixed(1) + 'K';
    }
    return price.toString();
}

function formatPriceExact(price) {
    return price.toLocaleString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    const errorSection = document.getElementById('error-section');
    errorSection.textContent = message;
    errorSection.classList.remove('hidden');
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorSection.classList.add('hidden');
    }, 5000);
}