// Default settings configuration
const defaultSettings = {
    // Price Update Settings
    updateInterval: 5, // minutes
    autoRefresh: true,
    backgroundUpdates: true,
    
    // Notification Settings
    desktopNotifications: true,
    soundAlerts: true, // Changed to true
    alertDuration: 0, // Changed to 0 (persistent until dismissed)
    notificationLimit: 10, // per hour
    
    // Display Settings
    priceFormat: 'gp', // Changed to 'gp' for detailed format
    sortOrder: 'date-added', // Changed to date-added
    showHistory: false,
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
    }
}

// Save settings to storage
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
        
        showMessage('Settings saved successfully!', 'success');
        
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
        const data = await chrome.storage.local.get(null);
        const syncData = await chrome.storage.sync.get(null);
        
        const exportData = {
            local: data,
            sync: syncData,
            exportDate: new Date().toISOString(),
            version: '1.0'
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
        
        showMessage('Data exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showMessage('Error exporting data. Please try again.', 'error');
    }
}

// Import user data
async function importData(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.version || !data.exportDate) {
            throw new Error('Invalid backup file format');
        }
        
        if (confirm('This will replace all current data. Are you sure you want to continue?')) {
            // Restore data
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
            
            showMessage('Data imported successfully! Please restart the extension.', 'success');
        }
        
    } catch (error) {
        console.error('Error importing data:', error);
        showMessage('Error importing data. Please check the file format.', 'error');
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
    // Save button
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    
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
    
    // Color picker changes
    document.getElementById('alertColorHigh').addEventListener('input', updateColorPreviews);
    document.getElementById('alertColorLow').addEventListener('input', updateColorPreviews);
    
    // Auto-save on certain changes
    const autoSaveElements = ['updateInterval', 'autoRefresh', 'backgroundUpdates', 'desktopNotifications'];
    autoSaveElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                // Auto-save after a short delay
                clearTimeout(window.autoSaveTimeout);
                window.autoSaveTimeout = setTimeout(saveSettings, 1000);
            });
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
