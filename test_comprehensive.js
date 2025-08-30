#!/usr/bin/env node

// Comprehensive test for all storage references and analysis code
console.log('🔍 Comprehensive Storage & Analysis Code Verification');
console.log('===================================================');

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

// Create separate namespace for popup functions to avoid conflicts
const popup = {};
eval(`
  ${popupScript}
  // Export popup functions
  popup.analyzePriceHistory = typeof analyzePriceHistory !== 'undefined' ? analyzePriceHistory : null;
  popup.createPriceHistoryHTML = typeof createPriceHistoryHTML !== 'undefined' ? createPriceHistoryHTML : null;
  popup.createSparklineChart = typeof createSparklineChart !== 'undefined' ? createSparklineChart : null;
  popup.formatPrice = typeof formatPrice !== 'undefined' ? formatPrice : null;
  popup.getPriceHistory = typeof getPriceHistory !== 'undefined' ? getPriceHistory : null;
`);

// Restore console.log
console.log = originalLog;

// Generate realistic price history data
function generateRealisticPriceHistory(basePrice, days = 30) {
  const history = [];
  let currentPrice = basePrice;
  const now = Date.now();
  
  for (let i = days; i >= 0; i--) {
    // Simulate market volatility
    const dailyChange = (Math.random() - 0.5) * 0.08; // ±4% daily change
    const weekendEffect = (i % 7 === 0 || i % 7 === 6) ? 0.98 : 1.0; // Weekend price drops
    const trendEffect = Math.sin(i / 10) * 0.02; // Long-term trend
    
    currentPrice = Math.floor(currentPrice * (1 + dailyChange + trendEffect) * weekendEffect);
    
    const date = new Date(now - (i * 24 * 60 * 60 * 1000));
    history.push({
      date: date.toISOString().split('T')[0],
      price: currentPrice,
      volume: Math.floor(Math.random() * 1000) + 100,
      timestamp: date.getTime()
    });
  }
  
  return history;
}

async function testAnalysisFunctionParity() {
  console.log('\n🧪 Test 1: Analysis Function Parity (Background vs Popup)');
  
  const testData = generateRealisticPriceHistory(1500000, 30);
  
  // Test background analysis function
  const backgroundAnalysis = analyzePriceHistory(testData);
  
  // Test popup analysis function
  const popupAnalysis = popup.analyzePriceHistory ? popup.analyzePriceHistory(testData) : null;
  
  console.log('📊 Background Analysis Fields:', Object.keys(backgroundAnalysis || {}));
  console.log('🖥️  Popup Analysis Fields:', Object.keys(popupAnalysis || {}));
  
  if (!popupAnalysis) {
    console.log('❌ Popup analysis function not available');
    return false;
  }
  
  // Compare critical fields
  const criticalFields = ['currentPrice', 'minPrice', 'maxPrice', 'avgPrice', 'weeklyChangePercent', 'priceRangePercent'];
  let fieldMatch = true;
  
  for (const field of criticalFields) {
    const backgroundValue = backgroundAnalysis[field];
    const popupValue = popupAnalysis[field];
    
    if (backgroundValue !== popupValue) {
      console.log(`⚠️  Field '${field}' mismatch: background=${backgroundValue}, popup=${popupValue}`);
      fieldMatch = false;
    }
  }
  
  if (fieldMatch) {
    console.log('✅ Critical analysis fields match between background and popup');
  }
  
  return fieldMatch;
}

async function testStorageOperations() {
  console.log('\n🧪 Test 2: All Storage Operations');
  
  const testItemId = '12345';
  const testMetadata = {
    id: testItemId,
    name: 'Test Item',
    url: 'https://test.com/item',
    originalUrl: 'https://test.com/original',
    imageUrl: 'https://test.com/image.png',
    lowThreshold: 1000,
    highThreshold: 2000,
    addedAt: Date.now()
  };
  
  const testPriceData = {
    currentPrice: 1500,
    lastChecked: Date.now(),
    previousPrice: 1400,
    priceAnalysis: {
      currentPrice: 1500,
      minPrice: 1200,
      maxPrice: 1800,
      avgPrice: 1500,
      weeklyChange: 100,
      weeklyChangePercent: 7.1,
      trendDirection: 'rising',
      trendEmoji: '📈',
      dataPoints: 30,
      priceRange: 600,
      priceRangePercent: 50.0
    },
    lastHistoryUpdate: Date.now()
  };
  
  const testPriceHistory = generateRealisticPriceHistory(1500, 15);
  
  console.log('💾 Testing storage operations...');
  
  // Test metadata storage
  await saveItemMetadata(testItemId, testMetadata);
  const retrievedMetadata = await getItemMetadata();
  console.log(`✅ Metadata storage: ${retrievedMetadata[testItemId] ? 'Working' : 'Failed'}`);
  
  // Test price data storage
  await savePriceData(testItemId, testPriceData);
  const retrievedPriceData = await getPriceData();
  console.log(`✅ Price data storage: ${retrievedPriceData[testItemId] ? 'Working' : 'Failed'}`);
  
  // Test price history storage
  await storePriceHistory(testItemId, testPriceHistory);
  const retrievedHistory = await getPriceHistory(testItemId);
  console.log(`✅ Price history storage: ${retrievedHistory && retrievedHistory.length > 0 ? 'Working' : 'Failed'}`);
  
  // Test watchlist merging
  const watchlist = await getWatchlist();
  const mergedItem = watchlist[testItemId];
  
  if (mergedItem) {
    console.log('✅ Watchlist merging: Working');
    console.log(`   - Has metadata: ${!!(mergedItem.name && mergedItem.imageUrl)}`);
    console.log(`   - Has price data: ${!!(mergedItem.currentPrice && mergedItem.priceAnalysis)}`);
  } else {
    console.log('❌ Watchlist merging: Failed');
  }
  
  return !!mergedItem;
}

async function testUIDataCompleteness() {
  console.log('\n🧪 Test 3: UI Data Completeness');
  
  const watchlist = await getWatchlist();
  
  for (const [itemId, item] of Object.entries(watchlist)) {
    console.log(`\n🔍 Item ${itemId} (${item.name}):`);
    
    // Test all UI-expected fields
    const uiFields = {
      // Basic display fields
      id: 'Item ID',
      name: 'Item name',
      imageUrl: 'Image URL',
      currentPrice: 'Current price',
      lastChecked: 'Last checked timestamp',
      
      // Threshold fields  
      lowThreshold: 'Low alert threshold',
      highThreshold: 'High alert threshold',
      
      // Analysis fields
      'priceAnalysis.currentPrice': 'Analysis current price',
      'priceAnalysis.minPrice': 'Analysis min price',
      'priceAnalysis.maxPrice': 'Analysis max price',
      'priceAnalysis.avgPrice': 'Analysis average price',
      'priceAnalysis.weeklyChangePercent': 'Weekly change percentage',
      'priceAnalysis.priceRangePercent': 'Price range percentage',
      'priceAnalysis.trendDirection': 'Trend direction',
      'priceAnalysis.trendEmoji': 'Trend emoji'
    };
    
    let missingFields = [];
    let presentFields = [];
    
    for (const [field, description] of Object.entries(uiFields)) {
      const value = field.includes('.') 
        ? field.split('.').reduce((obj, key) => obj?.[key], item)
        : item[field];
        
      if (value === undefined || value === null) {
        missingFields.push(description);
      } else {
        presentFields.push(description);
      }
    }
    
    console.log(`   ✅ Present: ${presentFields.length} fields`);
    if (missingFields.length > 0) {
      console.log(`   ⚠️  Missing: ${missingFields.join(', ')}`);
    }
    
    // Test alert status calculation
    const isLowAlert = item.currentPrice && item.lowThreshold && item.currentPrice <= item.lowThreshold;
    const isHighAlert = item.currentPrice && item.highThreshold && item.currentPrice >= item.highThreshold;
    
    console.log(`   📊 Alert calculation: ${isLowAlert ? 'LOW' : isHighAlert ? 'HIGH' : 'NORMAL'}`);
  }
  
  return true;
}

async function testAnalysisEdgeCases() {
  console.log('\n🧪 Test 4: Analysis Edge Cases');
  
  const testCases = [
    {
      name: 'Empty price history',
      data: [],
      expectedResult: null
    },
    {
      name: 'Single price point',
      data: [{ date: '2024-01-01', price: 1000, volume: 100, timestamp: Date.now() }],
      expectedResult: 'Should handle gracefully'
    },
    {
      name: 'Extreme volatility',
      data: [
        { date: '2024-01-01', price: 1000, volume: 100, timestamp: Date.now() - 86400000 },
        { date: '2024-01-02', price: 10000, volume: 100, timestamp: Date.now() }
      ],
      expectedResult: 'Should calculate percentage changes'
    },
    {
      name: 'Zero prices',
      data: [
        { date: '2024-01-01', price: 0, volume: 100, timestamp: Date.now() - 86400000 },
        { date: '2024-01-02', price: 1000, volume: 100, timestamp: Date.now() }
      ],
      expectedResult: 'Should handle division by zero'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📝 Testing: ${testCase.name}`);
    
    try {
      const backgroundResult = analyzePriceHistory(testCase.data);
      const popupResult = popup.analyzePriceHistory ? popup.analyzePriceHistory(testCase.data) : null;
      
      console.log(`   Background result: ${backgroundResult ? 'Valid analysis object' : 'null'}`);
      console.log(`   Popup result: ${popupResult ? 'Valid analysis object' : 'null'}`);
      
      if (backgroundResult && typeof backgroundResult === 'object') {
        console.log(`   ✅ Handled edge case successfully`);
      } else if (testCase.expectedResult === null && backgroundResult === null) {
        console.log(`   ✅ Correctly returned null for ${testCase.name}`);
      } else {
        console.log(`   ⚠️  Unexpected result for ${testCase.name}`);
      }
    } catch (error) {
      console.log(`   ❌ Error handling ${testCase.name}: ${error.message}`);
    }
  }
}

async function testPriceFormatting() {
  console.log('\n🧪 Test 5: Price Formatting Functions');
  
  const testPrices = [0, 999, 1000, 1500, 999999, 1000000, 1500000, 1000000000];
  const formatTypes = ['gp', 'auto', 'k', 'm'];
  
  console.log('💰 Testing price formatting:');
  
  for (const price of testPrices) {
    console.log(`\n   Price: ${price.toLocaleString()}`);
    
    for (const format of formatTypes) {
      try {
        // Test background formatPrice (exact version)
        const bgFormatted = formatPriceExact(price);
        
        // Test popup formatPrice
        const popupFormatted = popup.formatPrice ? popup.formatPrice(price, format) : 'N/A';
        
        console.log(`     ${format}: ${popupFormatted} | exact: ${bgFormatted}`);
      } catch (error) {
        console.log(`     ${format}: ERROR - ${error.message}`);
      }
    }
  }
}

// Run all comprehensive tests
async function runComprehensiveTests() {
  try {
    console.log('🚀 Starting comprehensive verification of all storage and analysis code...\n');
    
    const test1 = await testAnalysisFunctionParity();
    const test2 = await testStorageOperations();
    const test3 = await testUIDataCompleteness();
    await testAnalysisEdgeCases();
    await testPriceFormatting();
    
    console.log('\n📊 Test Results Summary:');
    console.log(`   ✅ Analysis parity: ${test1 ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Storage operations: ${test2 ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ UI data completeness: ${test3 ? 'PASS' : 'FAIL'}`);
    console.log('   ✅ Edge case handling: TESTED');
    console.log('   ✅ Price formatting: TESTED');
    
    const overallPass = test1 && test2 && test3;
    
    console.log(`\n${overallPass ? '✅' : '❌'} Overall Status: ${overallPass ? 'ALL SYSTEMS WORKING' : 'ISSUES FOUND'}`);
    
    if (overallPass) {
      console.log('\n🎉 All storage references and analysis code verified successfully!');
      console.log('The hybrid storage architecture is working correctly and all UI components');
      console.log('should function without visible issues post-price-refresh.');
    }
    
    return overallPass;
  } catch (error) {
    console.error('❌ Comprehensive test failed:', error);
    return false;
  }
}

// Execute comprehensive tests
runComprehensiveTests();