// Default settings configuration
const defaultSettings = {
    // Price Update Settings
    updateInterval: 5, // minutes
    autoRefresh: false,
    backgroundUpdates: true,
    
    // Notification Settings
    desktopNotifications: true,
    soundAlerts: true, // Changed to true
    alertDuration: 0, // Changed to 0 (persistent until dismissed)
    notificationLimit: 10, // per hour
    
    // Display Settings
    priceFormat: 'gp', // Changed to 'gp' for detailed format
    sortOrder: 'date-added', // Changed to date-added
    showHistory: true,
    chartHistoryDays: 30, // Default to 30 days for chart history
    compactView: false,
    
    // Alert Settings
    defaultAlertType: 'both', // 'above', 'below', 'both'
    alertThreshold: 10, // percentage
    snoozeDuration: 900000, // 15 minutes in milliseconds
    
    // Theme Settings
    alertColorHigh: '#27ae60',
    alertColorLow: '#e74c3c',
    darkMode: true,
    
    // Data Management
    autoRemoveDays: 0 // 0 = never remove
};

// Load settings when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
    updateColorPreviews();
});

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get('settings');
        const settings = { ...defaultSettings, ...(result.settings || {}) };
        
        // If no settings exist, save the defaults
        if (!result.settings) {
            console.log('No settings found, saving defaults');
            await chrome.storage.sync.set({ settings: defaultSettings });
        }
        
        // Update all form elements with stored settings
        Object.keys(settings).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = settings[key];
                } else {
                    element.value = settings[key];
                }
            }
        });
        
        updateColorPreviews();
    } catch (error) {
        console.error('Error loading settings:', error);
        showMessage('Error loading settings. Using defaults.', 'error');
        // Still populate form with defaults on error
        Object.keys(defaultSettings).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = defaultSettings[key];
                } else {
                    element.value = defaultSettings[key];
                }
            }
        });
    }
}

// Save settings to storage
let autoSaveTimeout;

async function autoSaveSettings() {
    // Clear any existing timeout
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    
    // Debounce auto-save to prevent excessive saving during rapid changes
    autoSaveTimeout = setTimeout(async () => {
        await saveSettings();
        showSuccessMessage();
    }, 500);
}

function showSuccessMessage() {
    const successMessage = document.getElementById('successMessage');
    successMessage.style.display = 'block';
    
    // Auto-hide the message after 2 seconds
    setTimeout(() => {
        successMessage.style.opacity = '0';
        setTimeout(() => {
            successMessage.style.display = 'none';
            successMessage.style.opacity = '0.9';
        }, 300);
    }, 2000);
}

async function saveSettings() {
    try {
        const settings = {};
        
        // Collect all settings from form elements
        Object.keys(defaultSettings).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    settings[key] = element.checked;
                } else if (element.type === 'number') {
                    settings[key] = parseInt(element.value) || defaultSettings[key];
                } else {
                    settings[key] = element.value || defaultSettings[key];
                }
            }
        });
        
        // Save to storage
        await chrome.storage.sync.set({ settings });
        
        // Update background script with new settings
        if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ 
                type: 'SETTINGS_UPDATED', 
                settings 
            });
        }
        
        // Don't show success message here - it will be called by autoSaveSettings
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showMessage('Error saving settings. Please try again.', 'error');
    }
}

// Reset settings to defaults
async function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to their defaults? This cannot be undone.')) {
        try {
            // Update form elements with default values
            Object.keys(defaultSettings).forEach(key => {
                const element = document.getElementById(key);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = defaultSettings[key];
                    } else {
                        element.value = defaultSettings[key];
                    }
                }
            });
            
            // Save defaults to storage
            await chrome.storage.sync.set({ settings: defaultSettings });
            
            // Update background script
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ 
                    type: 'SETTINGS_UPDATED', 
                    settings: defaultSettings 
                });
            }
            
            updateColorPreviews();
            showMessage('Settings reset to defaults successfully!', 'success');
            
        } catch (error) {
            console.error('Error resetting settings:', error);
            showMessage('Error resetting settings. Please try again.', 'error');
        }
    }
}

// Export user data
async function exportData() {
    try {
        // Get watchlist and settings from their respective storage locations
        const watchlistData = await getWatchlistForExport();
        const settingsData = await chrome.storage.sync.get('settings');
        
        const exportData = {
            watchlist: watchlistData,
            settings: settingsData.settings || {},
            exportDate: new Date().toISOString(),
            version: '1.0.2',
            exportSource: 'RS GE Price Tracker Extension'
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rs-ge-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('Data exported successfully! Use this file to import your watchlist on other devices.', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showMessage('Error exporting data. Please try again.', 'error');
    }
}

// Get watchlist data for export (handles hybrid storage architecture)
async function getWatchlistForExport() {
    try {
        // Check for legacy watchlist data first
        const legacyResult = await chrome.storage.sync.get(['watchlist']);
        if (legacyResult.watchlist && Object.keys(legacyResult.watchlist).length > 0) {
            return legacyResult.watchlist;
        }
        
        // Use hybrid storage approach: merge itemMetadata + priceData
        const metadata = await chrome.storage.sync.get(['itemMetadata']);
        const priceData = await chrome.storage.local.get(['priceData']);
        
        const itemMetadataObj = metadata.itemMetadata || {};
        const priceDataObj = priceData.priceData || {};
        
        // Merge the data sources like getWatchlist() does in background.js
        const watchlist = {};
        for (const [itemId, itemMetadata] of Object.entries(itemMetadataObj)) {
            const itemPriceData = priceDataObj[itemId] || {};
            
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
        
        console.log(`📤 Exporting ${Object.keys(watchlist).length} items from hybrid storage`);
        return watchlist;
    } catch (error) {
        console.error('Error getting watchlist for export:', error);
        return {};
    }
}

// Import user data
async function importData(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Check for new format (v1.0.2+)
        if (data.version && data.watchlist !== undefined) {
            if (confirm('This will replace your current watchlist and settings. Are you sure you want to continue?\n\nCurrent watchlist items will be lost.')) {
                
                // Import watchlist using hybrid storage architecture
                if (data.watchlist && Object.keys(data.watchlist).length > 0) {
                    // Split the watchlist data into metadata (sync) and price data (local)
                    const itemMetadata = {};
                    const priceData = {};
                    
                    for (const [itemId, item] of Object.entries(data.watchlist)) {
                        // Extract metadata for sync storage (lightweight data)
                        itemMetadata[itemId] = {
                            id: item.id,
                            name: item.name,
                            url: item.url,
                            originalUrl: item.originalUrl,
                            imageUrl: item.imageUrl,
                            lowThreshold: item.lowThreshold,
                            highThreshold: item.highThreshold,
                            addedAt: item.addedAt
                        };
                        
                        // Extract price data for local storage (heavy data)
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
                    
                    // Save to hybrid storage
                    await chrome.storage.sync.set({ itemMetadata });
                    if (Object.keys(priceData).length > 0) {
                        await chrome.storage.local.set({ priceData });
                    }
                    
                    console.log('Imported watchlist with', Object.keys(data.watchlist).length, 'items using hybrid storage');
                } else {
                    // Clear existing watchlist if importing empty data
                    await chrome.storage.sync.set({ itemMetadata: {} });
                    await chrome.storage.local.set({ priceData: {} });
                    console.log('Imported empty watchlist');
                }
                
                // Import settings
                if (data.settings && Object.keys(data.settings).length > 0) {
                    await chrome.storage.sync.set({ settings: data.settings });
                    console.log('Imported settings');
                }
                
                // Reload settings UI
                await loadSettings();
                
                const itemCount = Object.keys(data.watchlist || {}).length;
                showMessage(`Data imported successfully! ${itemCount} watchlist items restored. Changes will sync across your devices.`, 'success');
                
                // Send message to background script to update badge
                try {
                    await chrome.runtime.sendMessage({ action: 'refreshWatchlist' });
                } catch (e) {
                    console.log('Could not notify background script:', e);
                }
            }
        }
        // Handle legacy format (v1.0 and earlier)
        else if (data.version && (data.local || data.sync)) {
            if (confirm('This will replace all current data. Are you sure you want to continue?')) {
                // Restore legacy data
                if (data.local) {
                    await chrome.storage.local.clear();
                    await chrome.storage.local.set(data.local);
                }
                
                if (data.sync) {
                    await chrome.storage.sync.clear();
                    await chrome.storage.sync.set(data.sync);
                }
                
                // Reload settings
                await loadSettings();
                
                showMessage('Legacy data imported successfully! Please restart the extension.', 'success');
            }
        }
        // Invalid format
        else {
            throw new Error('Invalid backup file format. Please ensure you\'re importing a file exported from this extension.');
        }
        
    } catch (error) {
        console.error('Error importing data:', error);
        if (error.message.includes('Invalid backup file format')) {
            showMessage('Invalid backup file format. Please select a JSON file exported from this extension.', 'error');
        } else {
            showMessage('Error importing data. Please check that the file is valid and try again.', 'error');
        }
    }
}

// Update color previews
function updateColorPreviews() {
    const highColor = document.getElementById('alertColorHigh').value;
    const lowColor = document.getElementById('alertColorLow').value;
    
    document.getElementById('previewHigh').style.backgroundColor = highColor;
    document.getElementById('previewLow').style.backgroundColor = lowColor;
}

// Show success/error message
function showMessage(message, type = 'success') {
    const messageElement = document.getElementById('successMessage');
    messageElement.textContent = message;
    messageElement.className = type === 'success' ? 'success-message' : 'error-message';
    messageElement.style.display = 'block';
    
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 3000);
}

// Setup event listeners
function setupEventListeners() {
    // Reset button
    document.getElementById('resetSettings').addEventListener('click', resetSettings);
    
    // Close button
    document.getElementById('closeSettings').addEventListener('click', () => {
        window.close();
    });
    
    // Export button
    document.getElementById('exportData').addEventListener('click', exportData);
    
    // Import button and file input
    document.getElementById('importData').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    
    document.getElementById('importFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importData(file);
        }
    });
    
    // Color picker changes with auto-save
    document.getElementById('alertColorHigh').addEventListener('input', () => {
        updateColorPreviews();
        autoSaveSettings();
    });
    document.getElementById('alertColorLow').addEventListener('input', () => {
        updateColorPreviews();
        autoSaveSettings();
    });
    
    // Auto-save on all form field changes
    Object.keys(defaultSettings).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            // Add appropriate event listeners based on element type
            if (element.type === 'checkbox') {
                element.addEventListener('change', autoSaveSettings);
            } else if (element.type === 'number' || element.type === 'range') {
                element.addEventListener('input', autoSaveSettings);
                element.addEventListener('change', autoSaveSettings);
            } else {
                element.addEventListener('input', autoSaveSettings);
                element.addEventListener('change', autoSaveSettings);
            }
        }
    });
    
    // Validation for number inputs
    const numberInputs = document.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const min = parseInt(e.target.min);
            const max = parseInt(e.target.max);
            const value = parseInt(e.target.value);
            
            if (value < min) e.target.value = min;
            if (value > max) e.target.value = max;
        });
    });
}

// Handle messages from other parts of the extension
if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case 'GET_SETTINGS':
                loadSettings().then(() => {
                    const settings = {};
                    Object.keys(defaultSettings).forEach(key => {
                        const element = document.getElementById(key);
                        if (element) {
                            if (element.type === 'checkbox') {
                                settings[key] = element.checked;
                            } else if (element.type === 'number') {
                                settings[key] = parseInt(element.value);
                            } else {
                                settings[key] = element.value;
                            }
                        }
                    });
                    sendResponse({ settings });
                });
                return true; // Indicates async response
                
            case 'SETTINGS_CHANGED':
                loadSettings();
                break;
        }
    });
}
