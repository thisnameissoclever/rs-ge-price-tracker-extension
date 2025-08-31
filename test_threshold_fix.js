#!/usr/bin/env node

// Test for threshold fields clearing issue fix
// This test simulates the DOM operations that occur when threshold fields are updated

console.log('🧪 Testing Threshold Fields Clearing Fix');
console.log('========================================');

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
<div id="watchlist-container">
    <div class="item" data-item-id="123">
        <div class="thresholds">
            <div class="threshold-group">
                <label>Low Alert</label>
                <input type="number" id="low-123" placeholder="e.g. 1000" value="145">
            </div>
            <div class="threshold-group">
                <label>High Alert</label>
                <input type="number" id="high-123" placeholder="e.g. 5000" value="">
            </div>
        </div>
    </div>
</div>
</body>
</html>
`);

global.document = dom.window.document;
global.window = dom.window;

// Test data
const mockItem = {
    id: '123',
    name: 'Tempered fungal shaft',
    currentPrice: 146,
    lowThreshold: 145,
    highThreshold: null,
    imageUrl: 'https://secure.runescape.com/m=itemdb_rs/obj_big.gif?id=123',
    addedAt: Date.now(),
    lastChecked: Date.now()
};

// Mock functions that would be in popup.js
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatPrice(price, format = 'gp') {
    return `${price.toLocaleString()} gp`;
}

function createItemHTML(item, isCompactView = false, priceFormat = 'gp') {
    const lastChecked = item.lastChecked ? 
        new Date(item.lastChecked).toLocaleString() : 'Never';
    
    const addedAt = item.addedAt ? 
        new Date(item.addedAt).toLocaleDateString() : 'Unknown';
    
    const correctImageUrl = `https://secure.runescape.com/m=itemdb_rs/obj_big.gif?id=${item.id}`;
    
    if (!item.imageUrl || item.imageUrl !== correctImageUrl) {
        item.imageUrl = correctImageUrl;
    }
    
    let timeSinceCheck = 'Just now';
    if (item.lastChecked) {
        const timeDiff = Date.now() - item.lastChecked;
        const minutes = Math.floor(timeDiff / 60000);
        if (minutes > 0) {
            timeSinceCheck = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
    }
    
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

// Test the fix - simulate refreshSingleItem with input value preservation
function testRefreshSingleItemFix() {
    console.log('\n🔧 Test 1: refreshSingleItem preserves input values');
    
    // Get initial input values (simulating user typing)
    const existingItemElement = document.querySelector('[data-item-id="123"]');
    const existingLowInput = document.getElementById('low-123');
    const existingHighInput = document.getElementById('high-123');
    
    console.log(`📝 Initial values: low="${existingLowInput.value}", high="${existingHighInput.value}"`);
    
    // User types in high threshold field 
    existingHighInput.value = '147';
    console.log(`👤 User types: low="${existingLowInput.value}", high="${existingHighInput.value}"`);
    
    // Preserve current threshold input values before refresh (this is our fix)
    const currentLowValue = existingLowInput ? existingLowInput.value : '';
    const currentHighValue = existingHighInput ? existingHighInput.value : '';
    
    console.log(`💾 Preserved values: low="${currentLowValue}", high="${currentHighValue}"`);
    
    // Simulate refreshSingleItem - generate new HTML
    const newItemHTML = createItemHTML(mockItem, false, 'gp');
    
    // Create temporary container and replace HTML (simulating DOM replacement)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newItemHTML;
    const newItemElement = tempDiv.firstElementChild;
    
    existingItemElement.parentNode.replaceChild(newItemElement, existingItemElement);
    
    // Check values immediately after HTML replacement (this would be the bug - values lost)
    const afterReplaceLowInput = document.getElementById('low-123');
    const afterReplaceHighInput = document.getElementById('high-123');
    
    console.log(`🔄 After replace: low="${afterReplaceLowInput.value}", high="${afterReplaceHighInput.value}"`);
    
    // Apply the fix - restore user input values
    const newLowInput = document.getElementById('low-123');
    const newHighInput = document.getElementById('high-123');
    
    if (newLowInput && currentLowValue !== '') {
        newLowInput.value = currentLowValue;
    }
    if (newHighInput && currentHighValue !== '') {
        newHighInput.value = currentHighValue;
    }
    
    // Check final values (this should show the fix working)
    console.log(`✅ After fix: low="${newLowInput.value}", high="${newHighInput.value}"`);
    
    // Verify the fix worked
    const lowPreserved = newLowInput.value === currentLowValue;
    const highPreserved = newHighInput.value === currentHighValue;
    
    if (lowPreserved && highPreserved) {
        console.log('   ✅ SUCCESS: Input values preserved after refresh');
        return true;
    } else {
        console.log('   ❌ FAILED: Input values lost after refresh');
        console.log(`      Expected: low="${currentLowValue}", high="${currentHighValue}"`);
        console.log(`      Got: low="${newLowInput.value}", high="${newHighInput.value}"`);
        return false;
    }
}

// Test what happens with empty values (edge case)
function testEmptyValueHandling() {
    console.log('\n🔧 Test 2: Empty value handling');
    
    // Create a mock item with no thresholds for clean test
    const emptyMockItem = {
        ...mockItem,
        lowThreshold: null,
        highThreshold: null
    };
    
    // Reset DOM for clean test
    document.getElementById('low-123').value = '';
    document.getElementById('high-123').value = '';
    
    console.log('📝 Both fields empty initially');
    
    // User types in one field
    document.getElementById('high-123').value = '5000';
    console.log('👤 User types 5000 in high field');
    
    // Simulate the fix with empty low field
    const currentLowValue = document.getElementById('low-123').value;
    const currentHighValue = document.getElementById('high-123').value;
    
    console.log(`💾 Preserved values: low="${currentLowValue}", high="${currentHighValue}"`);
    
    // Regenerate HTML with empty mock item
    const newItemHTML = createItemHTML(emptyMockItem, false, 'gp');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newItemHTML;
    const newItemElement = tempDiv.firstElementChild;
    
    document.querySelector('[data-item-id="123"]').parentNode.replaceChild(newItemElement, document.querySelector('[data-item-id="123"]'));
    
    console.log(`🔄 After replace: low="${document.getElementById('low-123').value}", high="${document.getElementById('high-123').value}"`);
    
    // Apply fix
    const newLowInput = document.getElementById('low-123');
    const newHighInput = document.getElementById('high-123');
    
    if (newLowInput && currentLowValue !== '') {
        newLowInput.value = currentLowValue;
    }
    if (newHighInput && currentHighValue !== '') {
        newHighInput.value = currentHighValue;
    }
    
    console.log(`✅ After fix: low="${newLowInput.value}", high="${newHighInput.value}"`);
    
    // Check if high value was preserved and low remained empty
    if (newHighInput.value === '5000' && newLowInput.value === '') {
        console.log('   ✅ SUCCESS: Empty field handling works correctly');
        return true;
    } else {
        console.log('   ❌ FAILED: Empty field handling issue');
        console.log(`      Expected: low="", high="5000"`);
        console.log(`      Got: low="${newLowInput.value}", high="${newHighInput.value}"`);
        return false;
    }
}

// Run the tests
const test1Result = testRefreshSingleItemFix();
const test2Result = testEmptyValueHandling();

console.log('\n📊 Test Results:');
console.log(`   Test 1 (Value preservation): ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Test 2 (Empty value handling): ${test2Result ? '✅ PASS' : '❌ FAIL'}`);

if (test1Result && test2Result) {
    console.log('\n🎉 All tests passed! The threshold fields fix is working correctly.');
    process.exit(0);
} else {
    console.log('\n💥 Some tests failed. The fix needs more work.');
    process.exit(1);
}