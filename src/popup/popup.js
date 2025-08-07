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
    section.style.display = 'block';
    
    // Handle add button click
    addBtn.onclick = () => addCurrentItem(itemData);
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

async function refreshPrices() {
    const refreshBtn = document.getElementById('refresh-prices-btn');
    const container = document.getElementById('watchlist-container');
    
    try {
        // Show loading state
        const originalText = refreshBtn.textContent;
        refreshBtn.textContent = '🔄 Refreshing...';
        refreshBtn.disabled = true;
        
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
            removeBtn.onclick = () => removeItem(item.id);
        }
        
        // Update button
        const updateBtn = document.getElementById(`update-${item.id}`);
        if (updateBtn) {
            updateBtn.onclick = () => updateThresholds(item.id);
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
    
    return `
        <div class="item">
            <div class="item-header">
                <div class="item-name" title="${escapeHtml(item.name)}">
                    <a href="https://secure.runescape.com/m=itemdb_rs/viewitem?obj=${item.id}" 
                       target="_blank" 
                       style="color: #333; text-decoration: none; cursor: pointer;"
                       onmouseover="this.style.color='#2196F3'; this.style.textDecoration='underline';"
                       onmouseout="this.style.color='#333'; this.style.textDecoration='none';">
                        ${escapeHtml(item.name)}
                    </a>
                </div>
                <button id="remove-${item.id}" class="remove-btn" title="Remove from watchlist">×</button>
            </div>
            <div class="item-price" style="display: flex; justify-content: space-between; align-items: center;">
                <span>Current Price: <strong>${item.currentPrice ? formatPriceExact(item.currentPrice) + ' gp' : 'Unknown'}</strong></span>
                ${item.currentPrice ? `<small style="color: #666;">${timeSinceCheck}</small>` : ''}
            </div>
            <div class="thresholds">
                <div class="threshold-group">
                    <label>Low Alert (≤)</label>
                    <input type="number" id="low-${item.id}" placeholder="e.g. 1000" 
                           value="${item.lowThreshold || ''}" min="0">
                </div>
                <div class="threshold-group">
                    <label>High Alert (≥)</label>
                    <input type="number" id="high-${item.id}" placeholder="e.g. 5000" 
                           value="${item.highThreshold || ''}" min="0">
                </div>
                <button id="update-${item.id}" class="update-btn">Update Alerts</button>
            </div>
            <div class="last-checked" style="display: flex; justify-content: space-between;">
                <span>Added: ${addedAt}</span>
                <span>Last checked: ${lastChecked}</span>
            </div>
        </div>
    `;
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
    errorSection.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorSection.style.display = 'none';
    }, 5000);
}