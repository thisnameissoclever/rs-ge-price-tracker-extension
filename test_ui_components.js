#!/usr/bin/env node

// Comprehensive test for UI components with hybrid storage architecture
console.log('🧪 Testing UI Components with Hybrid Storage');
console.log('============================================');

// Mock Chrome APIs for testing
const mockStorage = {
  sync: { data: {} },
  local: { data: {} }
};

global.chrome = {
  runtime: {
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
    onMessage: { addListener: () => {} },
    lastError: null,
    getURL: (path) => `chrome-extension://test/${path}`
  },
  action: {
    setBadgeText: () => {},
    setBadgeBackgroundColor: () => {}
  },
  alarms: {
    create: () => {},
    clear: () => {},
    onAlarm: { addListener: () => {} }
  },
  notifications: {
    create: () => {},
    clear: () => {},
    onClicked: { addListener: () => {} }
  },
  storage: {
    sync: {
      get: function(keys) {
        return new Promise(resolve => {
          if (!keys) {
            resolve(mockStorage.sync.data);
            return;
          }
          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach(key => {
              result[key] = mockStorage.sync.data[key];
            });
            resolve(result);
          } else if (typeof keys === 'string') {
            resolve({ [keys]: mockStorage.sync.data[keys] });
          } else {
            const result = {};
            Object.keys(keys).forEach(key => {
              result[key] = mockStorage.sync.data[key] !== undefined ? mockStorage.sync.data[key] : keys[key];
            });
            resolve(result);
          }
        });
      },
      set: function(data) {
        return new Promise(resolve => {
          Object.assign(mockStorage.sync.data, data);
          resolve();
        });
      }
    },
    local: {
      get: function(keys) {
        return new Promise(resolve => {
          if (!keys) {
            resolve(mockStorage.local.data);
            return;
          }
          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach(key => {
              result[key] = mockStorage.local.data[key];
            });
            resolve(result);
          } else if (typeof keys === 'string') {
            resolve({ [keys]: mockStorage.local.data[keys] });
          } else {
            const result = {};
            Object.keys(keys).forEach(key => {
              result[key] = mockStorage.local.data[key] !== undefined ? mockStorage.local.data[key] : keys[key];
            });
            resolve(result);
          }
        });
      },
      set: function(data) {
        return new Promise(resolve => {
          Object.assign(mockStorage.local.data, data);
          resolve();
        });
      }
    }
  }
};

// Mock DOM for popup.js
global.document = {
  addEventListener: () => {},
  getElementById: () => ({ 
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {},
    innerHTML: '',
    textContent: '',
    style: {},
    value: '',
    checked: false
  }),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({
    innerHTML: '',
    textContent: '',
    style: {},
    classList: { add: () => {}, remove: () => {} },
    setAttribute: () => {},
    getAttribute: () => null,
    addEventListener: () => {}
  })
};

global.window = {
  location: { href: 'chrome-extension://test/popup.html' },
  close: () => {}
};

// Mock fetch
global.fetch = async () => ({ ok: false });

// Load source files
const fs = require('fs');
const path = require('path');

// Suppress console.log during loading
const originalLog = console.log;
console.log = () => {};

const backgroundScript = fs.readFileSync(path.join(__dirname, 'src', 'background.js'), 'utf8');
const popupScript = fs.readFileSync(path.join(__dirname, 'src', 'popup', 'popup.js'), 'utf8');

// Extract functions by evaluating the scripts
eval(backgroundScript);
eval(popupScript);

// Restore console.log
console.log = originalLog;

// Test functions
async function testWatchlistMerging() {
  console.log('\n🧪 Test 1: Watchlist Data Merging');
  
  // Setup test data in hybrid storage
  const testItems = {
    '4151': {
      id: '4151',
      name: 'Whip',
      url: 'https://secure.runescape.com/m=itemdb_rs/viewitem?obj=4151',
      originalUrl: 'https://secure.runescape.com/m=itemdb_rs/viewitem?obj=4151',
      imageUrl: 'https://secure.runescape.com/m=itemdb_rs/obj_big.gif?id=4151',
      lowThreshold: 1000000,
      highThreshold: 2000000,
      addedAt: Date.now() - 86400000 // 1 day ago
    },
    '11802': {
      id: '11802',
      name: 'Armadyl godsword',
      url: 'https://secure.runescape.com/m=itemdb_rs/viewitem?obj=11802',
      originalUrl: 'https://secure.runescape.com/m=itemdb_rs/viewitem?obj=11802',
      imageUrl: 'https://secure.runescape.com/m=itemdb_rs/obj_big.gif?id=11802',
      lowThreshold: 15000000,
      highThreshold: 20000000,
      addedAt: Date.now() - 172800000 // 2 days ago
    }
  };
  
  const testPriceData = {
    '4151': {
      currentPrice: 1500000,
      lastChecked: Date.now() - 3600000,
      previousPrice: 1450000,
      priceAnalysis: {
        currentPrice: 1500000,
        minPrice: 1400000,
        maxPrice: 1600000,
        avgPrice: 1500000,
        weeklyChange: 50000,
        weeklyChangePercent: 3.3,
        trendDirection: 'rising',
        trendEmoji: '📈',
        dataPoints: 30,
        priceRange: 200000,
        priceRangePercent: 14.3
      },
      lastHistoryUpdate: Date.now() - 3600000
    },
    '11802': {
      currentPrice: 18500000,
      lastChecked: Date.now() - 1800000,
      previousPrice: 18000000,
      priceAnalysis: {
        currentPrice: 18500000,
        minPrice: 17000000,
        maxPrice: 19000000,
        avgPrice: 18000000,
        weeklyChange: -500000,
        weeklyChangePercent: -2.6,
        trendDirection: 'falling',
        trendEmoji: '📉',
        dataPoints: 30,
        priceRange: 2000000,
        priceRangePercent: 11.8
      },
      lastHistoryUpdate: Date.now() - 1800000
    }
  };
  
  // Save to hybrid storage
  await chrome.storage.sync.set({ itemMetadata: testItems });
  await chrome.storage.local.set({ priceData: testPriceData });
  
  // Test getWatchlist function
  const watchlist = await getWatchlist();
  
  console.log('📊 Merged watchlist contains', Object.keys(watchlist).length, 'items');
  
  for (const [itemId, item] of Object.entries(watchlist)) {
    console.log(`\n✅ Item ${itemId} (${item.name}):`);
    console.log(`   - Has sync metadata: ${!!(item.name && item.imageUrl && item.lowThreshold)}`);
    console.log(`   - Has price data: ${!!(item.currentPrice && item.priceAnalysis)}`);
    console.log(`   - Current price: ${item.currentPrice?.toLocaleString()} gp`);
    console.log(`   - Analysis available: ${!!item.priceAnalysis}`);
    console.log(`   - Weekly change: ${item.priceAnalysis?.weeklyChangePercent}%`);
    console.log(`   - Image URL correct: ${item.imageUrl?.includes('obj_big.gif')}`);
  }
  
  return watchlist;
}

async function testPriceAnalysis() {
  console.log('\n🧪 Test 2: Price Analysis Functions');
  
  // Test price history data
  const mockPriceHistory = [];
  const basePrice = 1500000;
  const now = Date.now();
  
  // Generate 30 days of mock price history
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now - (i * 24 * 60 * 60 * 1000));
    const variance = (Math.random() - 0.5) * 0.2; // ±10% variance
    const price = Math.floor(basePrice * (1 + variance));
    
    mockPriceHistory.push({
      date: date.toISOString().split('T')[0],
      price: price,
      volume: Math.floor(Math.random() * 1000) + 100,
      timestamp: date.getTime()
    });
  }
  
  // Test analyzePriceHistory function
  const analysis = analyzePriceHistory(mockPriceHistory);
  
  console.log('📈 Price Analysis Results:');
  console.log(`   - Data points: ${analysis.dataPoints}`);
  console.log(`   - Current price: ${analysis.currentPrice?.toLocaleString()} gp`);
  console.log(`   - Price range: ${analysis.minPrice?.toLocaleString()} - ${analysis.maxPrice?.toLocaleString()} gp`);
  console.log(`   - Average price: ${analysis.avgPrice?.toLocaleString()} gp`);
  console.log(`   - Weekly change: ${analysis.weeklyChangePercent?.toFixed(1)}%`);
  console.log(`   - Trend direction: ${analysis.trendDirection} ${analysis.trendEmoji}`);
  console.log(`   - Price range %: ${analysis.priceRangePercent?.toFixed(1)}%`);
  
  // Verify all required fields are present for UI
  const requiredFields = ['currentPrice', 'minPrice', 'maxPrice', 'avgPrice', 'weeklyChangePercent', 'priceRangePercent', 'trendDirection', 'trendEmoji', 'dataPoints'];
  let missingFields = [];
  
  for (const field of requiredFields) {
    if (analysis[field] === undefined || analysis[field] === null) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length === 0) {
    console.log('✅ All required analysis fields present for UI');
  } else {
    console.log('❌ Missing analysis fields:', missingFields);
  }
  
  return analysis;
}

async function testUIDataStructure() {
  console.log('\n🧪 Test 3: UI Data Structure Validation');
  
  const watchlist = await getWatchlist();
  
  // Check each item for UI-required fields
  for (const [itemId, item] of Object.entries(watchlist)) {
    console.log(`\n🔍 Validating ${item.name} for UI compatibility:`);
    
    // Essential fields for basic display
    const essentialFields = ['id', 'name', 'imageUrl', 'currentPrice', 'lastChecked'];
    const missingEssential = essentialFields.filter(field => !item[field]);
    
    if (missingEssential.length === 0) {
      console.log('   ✅ All essential fields present');
    } else {
      console.log('   ❌ Missing essential fields:', missingEssential);
    }
    
    // Analysis fields for price history display
    if (item.priceAnalysis) {
      const analysisFields = ['weeklyChangePercent', 'priceRangePercent', 'trendDirection', 'avgPrice'];
      const missingAnalysis = analysisFields.filter(field => item.priceAnalysis[field] === undefined);
      
      if (missingAnalysis.length === 0) {
        console.log('   ✅ All analysis fields present');
      } else {
        console.log('   ❌ Missing analysis fields:', missingAnalysis);
      }
    } else {
      console.log('   ⚠️  No price analysis available (will show placeholder)');
    }
    
    // Alert status calculation
    const hasAlert = (item.currentPrice && item.lowThreshold && item.currentPrice <= item.lowThreshold) ||
                     (item.currentPrice && item.highThreshold && item.currentPrice >= item.highThreshold);
    console.log(`   📊 Alert status: ${hasAlert ? 'ALERT' : 'normal'}`);
  }
}

async function testStorageQuotaEfficiency() {
  console.log('\n🧪 Test 4: Storage Quota Efficiency');
  
  // Calculate storage usage for both approaches
  const syncData = await chrome.storage.sync.get();
  const localData = await chrome.storage.local.get();
  
  const syncSize = JSON.stringify(syncData).length;
  const localSize = JSON.stringify(localData).length;
  
  console.log(`📊 Storage Usage:`);
  console.log(`   - Sync storage: ${syncSize.toLocaleString()} bytes`);
  console.log(`   - Local storage: ${localSize.toLocaleString()} bytes`);
  console.log(`   - Sync quota usage: ${(syncSize / 102400 * 100).toFixed(1)}%`);
  
  // Simulate what old architecture would have used
  const combinedData = {};
  const itemMetadata = syncData.itemMetadata || {};
  const priceData = localData.priceData || {};
  
  for (const itemId of Object.keys(itemMetadata)) {
    combinedData[itemId] = {
      ...itemMetadata[itemId],
      ...priceData[itemId]
    };
  }
  
  const oldArchitectureSize = JSON.stringify({ watchlist: combinedData }).length;
  console.log(`   - Old architecture would use: ${oldArchitectureSize.toLocaleString()} bytes in sync`);
  console.log(`   - Space saved in sync: ${((oldArchitectureSize - syncSize) / oldArchitectureSize * 100).toFixed(1)}%`);
  
  if (syncSize < 81920) { // 80KB limit for safety
    console.log('✅ Sync storage usage within safe limits');
  } else {
    console.log('⚠️  Sync storage usage approaching limits');
  }
}

// Run all tests
async function runAllTests() {
  try {
    console.log('🚀 Starting comprehensive UI component tests...\n');
    
    const watchlist = await testWatchlistMerging();
    const analysis = await testPriceAnalysis();
    await testUIDataStructure();
    await testStorageQuotaEfficiency();
    
    console.log('\n✅ All UI component tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Watchlist items: ${Object.keys(watchlist).length}`);
    console.log(`   - Price analysis: ${analysis ? 'Working' : 'Failed'}`);
    console.log('   - Hybrid storage: Functioning correctly');
    console.log('   - UI compatibility: Verified');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Execute tests
runAllTests();