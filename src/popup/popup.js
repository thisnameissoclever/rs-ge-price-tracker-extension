// Popup script for RS Grand Exchange Price Tracker

// Default settings (should match background.js)
const DEFAULT_SETTINGS = {
    updateInterval: 5,
    autoRefresh: false,
    backgroundUpdates: true,
    desktopNotifications: true,
    soundAlerts: true,
    alertDuration: 0,
    notificationLimit: 10,
    priceFormat: 'gp',
    sortOrder: 'date-added',
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

// Helper function to get full price history from local storage (if needed)
async function getPriceHistory(itemId) {
    try {
        const result = await chrome.storage.local.get([`priceHistory_${itemId}`]);
        return result[`priceHistory_${itemId}`] || null;
    } catch (error) {
        console.error(`Failed to get price history for item ${itemId}:`, error);
        return null;
    }
}

// Get settings from Chrome storage
async function getSettings() {
    try {
        const result = await chrome.storage.sync.get('settings');
        return { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
    } catch (error) {
        console.error('Error getting settings:', error);
        return DEFAULT_SETTINGS;
    }
}

// Get color for volatility category
function getVolatilityColor(category) {
    switch (category) {
        case 'Low':
            return '#52b788'; // Mid green
        case 'Moderate':
            return '#f39c12'; // Current orange (keep as is)
        case 'High':
            return '#e74c3c'; // Mid red
        default:
            return '#f39c12'; // Default to orange
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded');
    
    // If opened in a full tab (via pop-out), enable wide columnar layout
    try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('tab') === '1') {
            document.body.classList.add('tab-view');
        }
    } catch (e) {
        // ignore
    }
    
    // Initialize popup
    initializePopup();
});

async function initializePopup() {
    try {
        // Check if current tab is an RS item page
        await checkCurrentPage();
        
        // Load and display watchlist
        await loadWatchlist();
        
        // Check if auto-refresh is enabled before auto-refreshing
        const settings = await getSettings();
        if (settings.autoRefresh) {
            // Auto-refresh prices when popup opens
            setTimeout(() => {
                autoRefreshPrices();
            }, 500); // Small delay to let UI load first
        }
        
        // Add refresh button event listener
        const refreshBtn = document.getElementById('refresh-prices-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshPrices);
        }
        
        // Add settings button event listener
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', openSettings);
        }
        
        // Add pop-out button event listener
        const popOutBtn = document.getElementById('pop-out-btn');
        if (popOutBtn) {
            popOutBtn.addEventListener('click', openPopOut);
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

async function showCurrentPageSection(itemData) {
    const section = document.getElementById('current-page-section');
    const infoDiv = document.getElementById('current-item-info');
    const addBtn = document.getElementById('add-current-btn');
    
    // Generate image URL if not present
    const imageUrl = itemData.imageUrl || `https://secure.runescape.com/m=itemdb_rs/obj_big.gif?id=${itemData.id}`;
    const imageHtml = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(itemData.name)}" class="item-image" style="margin-right: 10px;" data-fallback="hide">` : '';
    
    infoDiv.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
            ${imageHtml}
            <div>
                <strong>${escapeHtml(itemData.name)}</strong><br>
                ${itemData.currentPrice ? `Current Price: ${formatPriceExact(itemData.currentPrice)} gp` : 'Price: Unknown'}
            </div>
        </div>
    `;
    
    // Add error handling for image loading
    if (imageUrl) {
        const img = infoDiv.querySelector('img[data-fallback="hide"]');
        if (img) {
            img.addEventListener('error', function() {
                this.style.display = 'none';
            });
        }
    }
    
    // Check if item is already in watchlist
    try {
        const watchlistResponse = await sendMessage({ action: 'getWatchlist' });
        if (watchlistResponse.success && watchlistResponse.data[itemData.id]) {
            // Item already in watchlist
            addBtn.textContent = 'Already Tracking';
            addBtn.disabled = true;
            addBtn.style.background = '#566573';
        } else {
            // Item not in watchlist
            addBtn.textContent = 'Add to Watchlist';
            addBtn.disabled = false;
            addBtn.style.background = '';
            // Handle add button click
            addBtn.removeEventListener('click', addCurrentItem); // Remove any existing listener
            addBtn.addEventListener('click', () => addCurrentItem(itemData));
        }
    } catch (error) {
        console.error('Error checking watchlist status:', error);
        // Default to allowing add
        addBtn.textContent = 'Add to Watchlist';
        addBtn.disabled = false;
        addBtn.style.background = '';
        addBtn.removeEventListener('click', addCurrentItem);
        addBtn.addEventListener('click', () => addCurrentItem(itemData));
    }
    
    // Show the section
    section.classList.remove('hidden');
}

async function addCurrentItem(itemData) {
    const addBtn = document.getElementById('add-current-btn');
    
    try {
        console.log('🚀 Adding item to watchlist:', itemData);
        addBtn.textContent = 'Adding...';
        addBtn.disabled = true;

        // Send message to background script
        const response = await sendMessage({ action: 'addItem', itemData });
        
        console.log('📨 Background response:', response);
        
        if (response.success) {
            addBtn.textContent = 'Added!';
            addBtn.style.background = '#4CAF50';
            
            // Verify item was actually added by checking storage
            setTimeout(async () => {
                const verifyResponse = await sendMessage({ action: 'getWatchlist' });
                if (verifyResponse.success) {
                    console.log('✅ Verification - Item in watchlist:', !!verifyResponse.data[itemData.id]);
                    console.log('📊 Full watchlist:', verifyResponse.data);
                } else {
                    console.error('❌ Failed to verify watchlist');
                }
            }, 500);
            
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
        console.error('❌ Error adding item:', error);
        console.log('📍 Item data that failed:', itemData);
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
            await displayWatchlist(watchlist);
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
            await displayWatchlist(response.data);
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
            await displayWatchlist(response.data);
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

async function displayWatchlist(watchlist) {
    console.log('📋 DISPLAYING WATCHLIST - Raw data received:', watchlist);
    
    const container = document.getElementById('watchlist-container');
    
    const items = Object.values(watchlist);
    
    // Log detailed item information
    console.log('🔍 WATCHLIST ITEMS ANALYSIS:');
    items.forEach((item, index) => {
        console.log(`  Item ${index + 1}: ${item.name}`, {
            id: item.id,
            hasImageUrl: !!item.imageUrl,
            imageUrl: item.imageUrl || 'MISSING',
            currentPrice: item.currentPrice,
            addedAt: item.addedAt
        });
    });
    
    if (items.length === 0) {
        container.innerHTML = `
            <div class="watchlist-empty">
                No items in your watchlist yet.<br>
                Visit a RuneScape Grand Exchange item page and click "Track this item" or the extension icon to add items.
            </div>
        `;
        return;
    }
    
    // Debug: Check which items have price history
    console.log('🔍 Watchlist items price history status:');
    items.forEach(item => {
        const hasHistory = item.priceAnalysis || (item.lastHistoryUpdate && item.lastHistoryUpdate > 0);
        console.log(`  ${item.name}: ${hasHistory ? `✅ Has price analysis` : '❌ No price analysis'}`);
    });
    
    // Load settings to check compact view, price format, and sort order
    try {
        const settings = await getSettings();
        console.log('⚙️ Settings:', { showHistory: settings.showHistory, compactView: settings.compactView });
        
        const result = await chrome.storage.sync.get('sortOrder');
        const sortOrder = result.sortOrder || settings.sortOrder;
        
        renderWatchlistItems(items, container, settings.compactView, settings.priceFormat, sortOrder);
    } catch (error) {
        console.error('Error loading settings:', error);
        // Fallback to defaults
        renderWatchlistItems(items, container, DEFAULT_SETTINGS.compactView, DEFAULT_SETTINGS.priceFormat, DEFAULT_SETTINGS.sortOrder);
    }
}

function renderWatchlistItems(items, container, isCompactView, priceFormat = 'gp', sortOrder = 'date-added') {
    
    // Count items with alerts for header display
    let alertCount = 0;
    items.forEach(item => {
        if (item.currentPrice !== null && item.currentPrice !== undefined) {
            if ((item.lowThreshold && item.currentPrice <= item.lowThreshold) || 
                (item.highThreshold && item.currentPrice >= item.highThreshold)) {
                alertCount++;
            }
        }
    });
    
    // Update watchlist title to show alert count
    const watchlistTitle = document.querySelector('.watchlist-title');
    if (watchlistTitle) {
        if (alertCount > 0) {
            watchlistTitle.innerHTML = `Your Watchlist <span style="color: #e74c3c; font-weight: bold;">(${alertCount} alerts)</span>`;
        } else {
            watchlistTitle.textContent = 'Your Watchlist';
        }
    }
    
    // Sort items based on the selected sort order
    items.sort((a, b) => {
        const aHasAlert = (a.currentPrice !== null && 
                          ((a.lowThreshold && a.currentPrice <= a.lowThreshold) || 
                           (a.highThreshold && a.currentPrice >= a.highThreshold)));
        const bHasAlert = (b.currentPrice !== null && 
                          ((b.lowThreshold && b.currentPrice <= b.lowThreshold) || 
                           (b.highThreshold && b.currentPrice >= b.highThreshold)));
        
        switch (sortOrder) {
            case 'alerts-first':
                if (aHasAlert && !bHasAlert) return -1;
                if (!aHasAlert && bHasAlert) return 1;
                return a.name.localeCompare(b.name);
                
            case 'name-asc':
                return a.name.localeCompare(b.name);
                
            case 'name-desc':
                return b.name.localeCompare(a.name);
                
            case 'price-high':
                const aPrice = a.currentPrice || 0;
                const bPrice = b.currentPrice || 0;
                return bPrice - aPrice;
                
            case 'price-low':
                const aPriceLow = a.currentPrice || Infinity;
                const bPriceLow = b.currentPrice || Infinity;
                return aPriceLow - bPriceLow;
                
            case 'date-added':
                const aDate = a.addedAt || 0;
                const bDate = b.addedAt || 0;
                return bDate - aDate; // Newest first
                
            default:
                return a.name.localeCompare(b.name);
        }
    });
    
    container.innerHTML = items.map(item => createItemHTML(item, isCompactView, priceFormat)).join('');
    
    // Add event listeners for images and buttons and show price history
    items.forEach(item => {
        // Image error handling
        const img = document.querySelector(`[data-item-id="${item.id}"] img[data-fallback="hide"]`);
        if (img) {
            img.addEventListener('error', function() {
                this.style.display = 'none';
            });
        }
        
        // Remove button
        const removeBtn = document.getElementById(`remove-${item.id}`);
        if (removeBtn) {
            removeBtn.addEventListener('click', () => removeItem(item.id));
        }
        
        // Add auto-save listeners for threshold inputs
        const lowInput = document.getElementById(`low-${item.id}`);
        const highInput = document.getElementById(`high-${item.id}`);
        
        if (lowInput) {
            // Auto-save on input changes
            lowInput.addEventListener('input', () => {
                autoSaveThreshold(item.id, 'low');
            });
            
            // Auto-save on blur (when user clicks away)
            lowInput.addEventListener('blur', () => {
                autoSaveThreshold(item.id, 'low');
            });
        }
        
        if (highInput) {
            // Auto-save on input changes
            highInput.addEventListener('input', () => {
                autoSaveThreshold(item.id, 'high');
            });
            
            // Auto-save on blur (when user clicks away)
            highInput.addEventListener('blur', () => {
                autoSaveThreshold(item.id, 'high');
            });
        }
        
        // Show price history immediately if available and setting is enabled
        showPriceHistoryForItem(item, isCompactView);
    });
    
    // Add chart hover listeners for all rendered items
    setTimeout(() => {
        addChartHoverListeners(container);
    }, 100); // Small delay to ensure DOM is updated
}

// Separate function to handle price history display
async function showPriceHistoryForItem(item, isCompactView) {
    try {
        const settings = await getSettings();
        
        if (settings.showHistory && (item.priceAnalysis || item.lastHistoryUpdate)) {
            const historyContainer = document.querySelector(`[data-item-id="${item.id}"] .price-history`);
            if (historyContainer) {
                // Get actual price history data for the chart
                const priceHistory = await getPriceHistory(item.id);
                
                // Always recalculate analysis with fresh price history data
                let analysis = null;
                if (priceHistory && priceHistory.length > 0) {
                    analysis = analyzePriceHistory(priceHistory);
                    console.log(`🔄 Recalculated fresh analysis for ${item.name}:`, {
                        volatility: analysis.volatility.toFixed(2) + '%',
                        category: analysis.volatilityCategory,
                        rangePosition: analysis.rangePosition.toFixed(1) + '%',
                        tradingSignal: analysis.tradingSignal
                    });
                } else {
                    // Fallback to stored analysis if no price history available
                    analysis = item.priceAnalysis;
                    console.log(`📦 Using stored analysis for ${item.name} (no fresh price history)`);
                }
                
                if (analysis) {
                    historyContainer.innerHTML = createPriceHistoryHTML(analysis, isCompactView, priceHistory, settings.chartHistoryDays);
                    historyContainer.style.display = 'block';
                    
                    // Add hover event listeners for chart tooltips
                    addChartHoverListeners(historyContainer);
                    
                    console.log(`📊 Showing fresh price analysis for ${item.name} with ${priceHistory ? priceHistory.length : 0} history points`);
                } else {
                    console.log(`❌ No analysis data available for ${item.name}`);
                }
            }
        } else if (settings.showHistory && (!item.priceAnalysis && !item.lastHistoryUpdate)) {
            // Show a placeholder indicating history will be available after next refresh
            const historyContainer = document.querySelector(`[data-item-id="${item.id}"] .price-history`);
            if (historyContainer) {
                historyContainer.innerHTML = `
                    <div class="price-history-placeholder">
                        <span style="color: #95a5a6; font-size: 11px; font-style: italic;">
                            📈 Price history will be available after next refresh
                        </span>
                    </div>
                `;
                historyContainer.style.display = 'block';
                console.log(`📈 Showing history placeholder for ${item.name}`);
            }
        } else {
            console.log(`⚙️ Price history disabled or no analysis for ${item.name} (showHistory: ${settings.showHistory}, hasAnalysis: ${!!item.priceAnalysis})`);
        }
    } catch (error) {
        console.error(`Error showing price history for ${item.name}:`, error);
    }
}

function createItemHTML(item, isCompactView = false, priceFormat = 'gp') {
    const lastChecked = item.lastChecked ? 
        new Date(item.lastChecked).toLocaleString() : 'Never';
    
    const addedAt = item.addedAt ? 
        new Date(item.addedAt).toLocaleDateString() : 'Unknown';
    
    // Generate correct image URL if missing or incorrect
    const correctImageUrl = `https://secure.runescape.com/m=itemdb_rs/obj_big.gif?id=${item.id}`;
    
    if (!item.imageUrl || item.imageUrl !== correctImageUrl) {
        if (!item.imageUrl) {
            console.log(`🖼️ POPUP: Item ${item.name} missing imageUrl, applying correct URL`);
        } else {
            console.log(`🔄 POPUP: Item ${item.name} has outdated imageUrl, updating to correct format`);
            console.log(`   Old URL: ${item.imageUrl}`);
            console.log(`   New URL: ${correctImageUrl}`);
        }
        item.imageUrl = correctImageUrl;
        console.log(`✅ POPUP: Applied correct imageUrl for ${item.name}: ${item.imageUrl}`);
    } else {
        console.log(`✅ POPUP: Item ${item.name} already has correct imageUrl: ${item.imageUrl}`);
    }
    
    // Use stored analysis if available
    const historyAnalysis = item.priceAnalysis || null;
        
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
    
    if (isCompactView) {
        // Compact view - single line with essential info only
        const imageHtml = item.imageUrl ? 
            `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" class="compact-item-image" data-fallback="hide">` : '';
            
        return `
            <div class="item compact-item ${itemClass}" data-item-id="${item.id}" data-alert-status="${alertStatus}">
                <div class="compact-content ${item.imageUrl ? 'compact-content-with-image' : ''}">
                    ${imageHtml}
                    <div class="compact-info">
                        <div class="compact-name-price">
                            <a href="https://secure.runescape.com/m=itemdb_rs/viewitem?obj=${item.id}" 
                               target="_blank" 
                               class="item-link ${alertStatus !== 'normal' ? 'item-link-alert' : ''}">
                                ${escapeHtml(item.name)}
                            </a>
                            ${alertIndicator}
                            <span class="compact-price ${alertStatus !== 'normal' ? 'current-price-alert' : ''}">
                                ${item.currentPrice ? formatPrice(item.currentPrice, priceFormat) : 'Unknown'}
                            </span>
                        </div>
                        <div class="compact-controls">
                            <input type="number" id="low-${item.id}" placeholder="Low" 
                                   value="${item.lowThreshold || ''}" min="0"
                                   class="compact-input ${alertStatus !== 'normal' ? 'threshold-input-alert' : ''}" 
                                   title="Low alert threshold">
                            <input type="number" id="high-${item.id}" placeholder="High" 
                                   value="${item.highThreshold || ''}" min="0"
                                   class="compact-input ${alertStatus !== 'normal' ? 'threshold-input-alert' : ''}" 
                                   title="High alert threshold">

                            <button id="remove-${item.id}" class="compact-remove-btn" title="Remove from watchlist">×</button>
                        </div>
                    </div>
                </div>
                <div class="price-history" style="display: none;"></div>
            </div>
        `;
    }
    
    // Full view (original)
    const imageHtml = item.imageUrl ? 
        `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" class="item-image" data-fallback="hide">` : '';
    
    return `
        <div class="item ${itemClass}" data-item-id="${item.id}" data-alert-status="${alertStatus}">
            <div class="${item.imageUrl ? 'item-header-with-image' : 'item-header'}">
                ${imageHtml}
                <div class="item-info">
                    <div class="item-name" title="${escapeHtml(item.name)}">
                        <a href="https://secure.runescape.com/m=itemdb_rs/viewitem?obj=${item.id}" 
                           target="_blank" 
                           class="item-link ${alertStatus !== 'normal' ? 'item-link-alert' : ''}">
                            ${escapeHtml(item.name)}
                        </a>
                        ${alertIndicator}
                    </div>
                </div>
                <button id="remove-${item.id}" class="remove-btn" title="Remove from watchlist">×</button>
            </div>
            <div class="item-price">
                <span class="current-price ${alertStatus !== 'normal' ? 'current-price-alert' : ''}">
                    Current Price: <strong>${item.currentPrice ? formatPrice(item.currentPrice, priceFormat) : 'Unknown'}</strong>
                </span>
                ${item.currentPrice ? `<small class="time-since ${alertStatus !== 'normal' ? 'time-since-alert' : ''}">${timeSinceCheck}</small>` : ''}
            </div>
            <div class="price-history" style="display: none;"></div>
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
            </div>
            <div class="last-checked ${alertStatus !== 'normal' ? 'last-checked-alert' : ''}">
                <span>Added: ${addedAt}</span>
                <span>Last checked: ${lastChecked}</span>
            </div>
        </div>
    `;
}

async function refreshSingleItem(updatedItem) {
    // Find the existing item element
    const existingItemElement = document.querySelector(`[data-item-id="${updatedItem.id}"]`);
    if (!existingItemElement) {
        console.log('Item element not found for refresh:', updatedItem.id);
        return;
    }
    
    // Check if we're in compact view
    const isCompactView = existingItemElement.classList.contains('compact-item');
    
    // Get current settings for proper formatting
    const settings = await getSettings();
    
    // Create new HTML for the item with current settings
    const newItemHTML = createItemHTML(updatedItem, isCompactView, settings.priceFormat);
    
    // Create a temporary container to parse the new HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newItemHTML;
    const newItemElement = tempDiv.firstElementChild;
    
    // Replace the old element with the new one
    existingItemElement.parentNode.replaceChild(newItemElement, existingItemElement);
    
    // Re-attach event listeners for this specific item
    // Image error handling
    const img = newItemElement.querySelector('img[data-fallback="hide"]');
    if (img) {
        img.addEventListener('error', function() {
            this.style.display = 'none';
        });
    }
    
    const removeBtn = document.getElementById(`remove-${updatedItem.id}`);
    if (removeBtn) {
        removeBtn.addEventListener('click', () => removeItem(updatedItem.id));
    }
    
    
    // Add auto-save listeners for threshold inputs
    const lowInput = document.getElementById(`low-${updatedItem.id}`);
    const highInput = document.getElementById(`high-${updatedItem.id}`);
    
    if (lowInput) {
        // Auto-save on input changes
        lowInput.addEventListener('input', () => {
            autoSaveThreshold(updatedItem.id, 'low');
        });
        
        // Auto-save on blur (when user clicks away)
        lowInput.addEventListener('blur', () => {
            autoSaveThreshold(updatedItem.id, 'low');
        });
    }
    
    if (highInput) {
        // Auto-save on input changes
        highInput.addEventListener('input', () => {
            autoSaveThreshold(updatedItem.id, 'high');
        });
        
        // Auto-save on blur (when user clicks away)
        highInput.addEventListener('blur', () => {
            autoSaveThreshold(updatedItem.id, 'high');
        });
    }
    
    // Add price history if showHistory is enabled and data is available
    showPriceHistoryForItem(updatedItem, isCompactView);
    
    // Add chart hover listeners for the refreshed item
    setTimeout(() => {
        addChartHoverListeners(newItemElement);
    }, 100);
    
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

// Auto-save threshold function with enhanced validation
async function autoSaveThreshold(itemId, inputType) {
    const lowInput = document.getElementById(`low-${itemId}`);
    const highInput = document.getElementById(`high-${itemId}`);
    
    if (!lowInput || !highInput) {
        console.error('Threshold inputs not found for item:', itemId);
        return;
    }

    try {
        // Get current values
        let lowValue = lowInput.value.trim();
        let highValue = highInput.value.trim();
        
        // Get current item data for negative number handling
        const watchlistResponse = await sendMessage({ action: 'getWatchlist' });
        if (!watchlistResponse.success) {
            console.error('Failed to get watchlist for validation');
            return;
        }
        
        const item = watchlistResponse.data[itemId];
        const currentPrice = item ? item.currentPrice : null;
        
        // Process low threshold
        let lowPrice = null;
        if (lowValue) {
            if (lowValue.startsWith('-')) {
                // Handle negative numbers - subtract from current price
                const negativeAmount = Math.abs(parseFloat(lowValue));
                if (!isNaN(negativeAmount) && currentPrice) {
                    lowPrice = Math.max(0, currentPrice - negativeAmount);
                    lowInput.value = lowPrice.toString();
                } else {
                    lowInput.value = ''; // Clear invalid input
                }
            } else {
                lowPrice = parseFloat(lowValue);
                if (isNaN(lowPrice)) {
                    lowInput.value = ''; // Clear invalid input
                    lowPrice = null;
                } else if (lowPrice > 1000000000000) { // 1 trillion limit
                    lowPrice = 1000000000000;
                    lowInput.value = lowPrice.toString();
                } else if (lowPrice < 0) {
                    lowInput.value = ''; // Clear negative input that doesn't start with '-'
                    lowPrice = null;
                }
            }
        }
        
        // Process high threshold
        let highPrice = null;
        if (highValue) {
            if (highValue.startsWith('-')) {
                // Handle negative numbers - subtract from current price
                const negativeAmount = Math.abs(parseFloat(highValue));
                if (!isNaN(negativeAmount) && currentPrice) {
                    highPrice = Math.max(0, currentPrice - negativeAmount);
                    highInput.value = highPrice.toString();
                } else {
                    highInput.value = ''; // Clear invalid input
                }
            } else {
                highPrice = parseFloat(highValue);
                if (isNaN(highPrice)) {
                    highInput.value = ''; // Clear invalid input
                    highPrice = null;
                } else if (highPrice > 1000000000000) { // 1 trillion limit
                    highPrice = 1000000000000;
                    highInput.value = highPrice.toString();
                } else if (highPrice < 0) {
                    highInput.value = ''; // Clear negative input that doesn't start with '-'
                    highPrice = null;
                }
            }
        }
        
        // Validate that low < high if both are set
        if (lowPrice !== null && highPrice !== null && lowPrice >= highPrice) {
            // If user just changed low and it's >= high, clear high
            // If user just changed high and it's <= low, clear low
            if (inputType === 'low') {
                highInput.value = '';
                highPrice = null;
            } else if (inputType === 'high') {
                lowInput.value = '';
                lowPrice = null;
            }
        }
        
        // Save the thresholds (don't show error messages for auto-save)
        const response = await sendMessage({ 
            action: 'updateThresholds', 
            itemId, 
            lowPrice, 
            highPrice 
        });
        
        if (response.success) {
            // Silently refresh the item display
            const updatedItemResponse = await sendMessage({ action: 'getWatchlist' });
            if (updatedItemResponse.success) {
                const updatedItem = updatedItemResponse.data[itemId];
                if (updatedItem) {
                    await refreshSingleItem(updatedItem);
                }
            }
        } else {
            console.warn('Auto-save failed for item:', itemId, response.error);
        }
        
    } catch (error) {
        console.error('Error in auto-save threshold:', error);
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
                    await refreshSingleItem(updatedItem);
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
        
        // Provide more specific error message for concurrent update conflicts
        let errorMessage = 'Failed to update alerts: ' + error.message;
        if (error.message.includes('overwritten') || error.message.includes('concurrent')) {
            errorMessage = 'Update conflict detected. Please try again in a moment.';
        }
        
        showError(errorMessage);
        
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

function formatPrice(price, format = 'gp') {
    if (!price || price === null || price === undefined) return 'Unknown';
    
    switch (format) {
        case 'gp':
            return price.toLocaleString() + ' gp';
        case 'k':
            return (price / 1000).toFixed(1) + 'k';
        case 'm':
            return (price / 1000000).toFixed(2) + 'm';
        case 'auto':
        default:
            if (price >= 1000000) {
                return (price / 1000000).toFixed(1) + 'm';
            } else if (price >= 1000) {
                return (price / 1000).toFixed(1) + 'k';
            }
            return price.toLocaleString() + ' gp';
    }
}

function formatPriceExact(price) {
    return price.toLocaleString();
}

// Open settings page
function openSettings() {
    chrome.tabs.create({
        url: chrome.runtime.getURL('src/settings/settings.html')
    });
}

// Open popup in full tab
function openPopOut() {
    // Pass a flag so the page can switch to the columnar layout
    const tabUrl = chrome.runtime.getURL('src/popup/popup.html?tab=1');
    chrome.tabs.create({
        url: tabUrl
    }, () => {
        // Close the popup after opening the tab
        window.close();
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add hover event listeners for chart tooltips
function addChartHoverListeners(container) {
    const chartElements = container.querySelectorAll('.chart-placeholder[data-chart-id]');
    
    chartElements.forEach(chartElement => {
        const chartId = chartElement.getAttribute('data-chart-id');
        const tooltip = document.getElementById(`tooltip-${chartId}`);
        
        if (tooltip) {
            let hoverTimeout;
            
            // Show tooltip on hover
            chartElement.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
                tooltip.classList.add('visible');
            });
            
            // Hide tooltip when mouse leaves
            chartElement.addEventListener('mouseleave', () => {
                // Add a small delay to prevent flickering
                hoverTimeout = setTimeout(() => {
                    tooltip.classList.remove('visible');
                }, 100);
            });
            
            // Keep tooltip visible when hovering over it
            tooltip.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
            });
            
            tooltip.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        }
    });
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

    // Advanced positioning metrics (align with background)
    const range = maxPrice - minPrice;
    const rangePosition = range > 0 ? ((currentPrice - minPrice) / range * 100) : 50; // 0 at low, 100 at high
    const zScore = stdDev > 0 ? ((currentPrice - avgPrice) / stdDev) : 0;
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

// Create price history HTML
function createPriceHistoryHTML(analysis, isCompactView = false, priceHistory = null, chartHistoryDays = 14) {
    if (!analysis) return '';
    
    const changeColor = analysis.weeklyChangePercent > 0 ? '#27ae60' : 
                       analysis.weeklyChangePercent < 0 ? '#e74c3c' : '#95a5a6';
    
    if (isCompactView) {
        return `
            <div class="price-history-compact">
                <span class="trend-indicator" style="color: ${changeColor}">
                    ${analysis.trendEmoji} ${analysis.weeklyChangePercent > 0 ? '+' : ''}${analysis.weeklyChangePercent.toFixed(1)}%
                </span>
                <span class="price-range" title="30-day range">
                    ${formatPriceExact(analysis.minPrice)} - ${formatPriceExact(analysis.maxPrice)} gp
                </span>
            </div>
        `;
    }
    
    return `
        <div class="price-history-full">
            <div class="history-stats">
                <div class="stat-row">
                    <span class="stat-label">7-day trend:</span>
                    <span class="stat-value" style="color: ${changeColor}">
                        ${analysis.trendEmoji} ${analysis.weeklyChangePercent > 0 ? '+' : ''}${analysis.weeklyChangePercent.toFixed(1)}%
                        (${analysis.weeklyChange > 0 ? '+' : ''}${formatPriceExact(analysis.weeklyChange)} gp)
                    </span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">30-day range:</span>
                    <span class="stat-value">
                        ${formatPriceExact(analysis.minPrice)} - ${formatPriceExact(analysis.maxPrice)} gp
                        <small>(${analysis.priceRangePercent.toFixed(1)}% variation)</small>
                    </span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">30-day average:</span>
                    <span class="stat-value">${formatPriceExact(analysis.avgPrice)} gp</span>
                </div>
                ${analysis.dataPoints > 5 ? `
                <div class="stat-row">
                    <span class="stat-label">Volatility:</span>
                    <span class="stat-value" style="color: ${getVolatilityColor(analysis.volatilityCategory)}">
                        ${analysis.volatilityCategory} ${analysis.volatilityEmoji}
                    </span>
                </div>` : ''}
            </div>
            <div class="mini-chart">
                ${createMiniChart(analysis, priceHistory, chartHistoryDays)}
            </div>
        </div>
    `;
}

// Create a simple mini chart using CSS
function createMiniChart(analysis, priceHistory, chartHistoryDays = 14) {
    if (!analysis) return '';
    
    // Create a unique ID for this chart for event handling
    const chartId = `chart-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate visual chart and insights
    const chartContent = createSparklineChart(analysis, priceHistory, chartHistoryDays);
    
    return `
        <div class="chart-placeholder" data-chart-id="${chartId}" data-analysis='${JSON.stringify(analysis)}'>
            📊 Chart (hover for details)
            <div class="chart-tooltip" id="tooltip-${chartId}">
                ${chartContent}
            </div>
        </div>
    `;
}

// Create sparkline chart and unique insights
function createSparklineChart(analysis, priceHistory, chartHistoryDays = 14) {
    // Generate sparkline bars (last chartHistoryDays data points for visual clarity)
    let sparklineBars = '';
    let insights = [];
    let rangePosition = 50; // Default to middle of range
    
    if (priceHistory && priceHistory.length > 0) {
        // Take last chartHistoryDays points or all if less than chartHistoryDays
        const recentData = priceHistory.slice(-chartHistoryDays);
        const prices = recentData.map(p => p.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;
        
        // Generate bars
        prices.forEach((price, index) => {
            const height = priceRange > 0 ? Math.max(2, ((price - minPrice) / priceRange) * 28) : 15;
            let barClass = 'sparkline-bar';
            
            // Highlight special bars
            if (index === prices.length - 1) barClass += ' recent'; // Latest price
            if (price === maxPrice) barClass += ' highest';
            if (price === minPrice) barClass += ' lowest';
            
            sparklineBars += `<div class="${barClass}" style="height: ${height}px;" title="${formatPriceExact(price)} gp"></div>`;
        });
        
        console.log(`📊 Generated ${prices.length} bars for sparkline (range: ${minPrice}-${maxPrice})`);
        console.log(`🎯 Price range: ${priceRange} gp, bars created: ${prices.length}`);
        console.log(`📈 Analysis data: min=${analysis.minPrice}, max=${analysis.maxPrice}, current=${analysis.currentPrice}, avg=${analysis.avgPrice}`);
        
        // Calculate unique insights not shown elsewhere
        
        // 1. Price volatility (simple version - count days with >5% change from average)
        const avgPrice = analysis.avgPrice;
        const volatileCount = prices.filter(p => {
            if (avgPrice === 0) return false;
            const deviation = Math.abs(p - avgPrice) / avgPrice;
            return deviation > 0.05; // More than 5% swing from average
        }).length;
        const volatilityPercent = prices.length > 0 ? Math.round((volatileCount / prices.length) * 100) : 0;
        
        console.log(`🔍 Volatility calc: avg=${avgPrice}, volatile=${volatileCount}/${prices.length}, %=${volatilityPercent}`);
        console.log(`📊 Sample prices vs avg (${avgPrice}):`, prices.slice(0, 3).map(p => `${p} (${(((p-avgPrice)/avgPrice)*100).toFixed(1)}%)`));
        
        // 2. Momentum (comparing recent 3 days to previous 3 days)
        if (prices.length >= 6) {
            const recentAvg = prices.slice(-3).reduce((a, b) => a + b, 0) / 3;
            const previousAvg = prices.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
            const momentum = ((recentAvg - previousAvg) / previousAvg) * 100;
            insights.push({
                label: 'Recent momentum:',
                value: `${momentum > 0 ? '+' : ''}${momentum.toFixed(1)}%`,
                class: momentum > 2 ? 'insight-positive' : momentum < -2 ? 'insight-negative' : 'insight-neutral'
            });
        }
        
        // 3. Price volatility indicator (renamed from stability)
        insights.push({
            label: 'Price swings:',
            value: `${volatilityPercent}% of days`,
            class: volatilityPercent > 50 ? 'insight-negative' : volatilityPercent < 20 ? 'insight-positive' : 'insight-neutral'
        });
        
        // 4. Days since peak/low
        const recentPrice = prices[prices.length - 1]; // Last price in the recent data
        const daysSincePeak = prices.length - 1 - prices.lastIndexOf(maxPrice);
        const daysSinceLow = prices.length - 1 - prices.lastIndexOf(minPrice);
        
        if (daysSincePeak === 0) {
            insights.push({ label: 'Status:', value: 'At recent peak!', class: 'insight-positive' });
        } else if (daysSinceLow === 0) {
            insights.push({ label: 'Status:', value: 'At recent low!', class: 'insight-negative' });
        } else {
            insights.push({
                label: 'Peak/Low distance:',
                value: `${daysSincePeak}d / ${daysSinceLow}d`,
                class: 'insight-neutral'
            });
        }
        
        // 5. Use pre-calculated trading signal from analysis
        if (analysis.tradingSignal && analysis.tradingSignalClass) {
            const signalClass = analysis.tradingSignalClass === 'positive' ? 'insight-positive' : 
                               analysis.tradingSignalClass === 'negative' ? 'insight-negative' : 'insight-neutral';
            insights.push({
                label: 'Trading signal:',
                value: analysis.tradingSignal,
                class: signalClass
            });
        }
    }
    
    return `
        <div class="mini-sparkline">
            <div class="sparkline-header">
                <span>Last ${chartHistoryDays} Days</span>
                <span>${formatPriceExact(analysis.minPrice)} - ${formatPriceExact(analysis.maxPrice)} gp</span>
            </div>
            <div class="sparkline-chart">
                ${sparklineBars || '<span style="color: #95a5a6; font-size: 10px;">No recent data</span>'}
            </div>
            ${insights.length > 0 ? `
            <div class="sparkline-insights">
                ${insights.map(insight => `
                    <div class="insight-row">
                        <span class="insight-label">${insight.label}</span>
                        <span class="${insight.class}">${insight.value}</span>
                    </div>
                `).join('')}
                <div class="insight-row">
                    <span class="insight-label">Position:</span>
                    <span class="insight-neutral">${(analysis.rangePosition || rangePosition || 50).toFixed(0)}% of 30d range</span>
                </div>
            </div>` : ''}
        </div>
    `;
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