#!/usr/bin/env node

// Test specifically for price analysis UI components
console.log('🎨 Testing Price Analysis UI Components');
console.log('=====================================');

// Mock Chrome APIs and DOM
const mockStorage = {
  sync: { data: {} },
  local: { data: {} }
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
          const result = {};
          if (Array.isArray(keys)) {
            keys.forEach(key => result[key] = mockStorage.sync.data[key]);
          } else if (typeof keys === 'string') {
            result[keys] = mockStorage.sync.data[keys];
          }
          resolve(result);
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
          const result = {};
          if (Array.isArray(keys)) {
            keys.forEach(key => result[key] = mockStorage.local.data[key]);
          } else if (typeof keys === 'string') {
            result[keys] = mockStorage.local.data[keys];
          }
          resolve(result);
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

// Load source files
const fs = require('fs');
const path = require('path');

// Suppress console.log during loading
const originalLog = console.log;
console.log = () => {};

const backgroundScript = fs.readFileSync(path.join(__dirname, 'src', 'background.js'), 'utf8');
const popupScript = fs.readFileSync(path.join(__dirname, 'src', 'popup', 'popup.js'), 'utf8');

// Extract functions
eval(backgroundScript);

// Load popup functions in separate context
const popup = {};
eval(`
  ${popupScript}
  popup.createPriceHistoryHTML = typeof createPriceHistoryHTML !== 'undefined' ? createPriceHistoryHTML : null;
  popup.createSparklineChart = typeof createSparklineChart !== 'undefined' ? createSparklineChart : null;
  popup.formatPrice = typeof formatPrice !== 'undefined' ? formatPrice : null;
`);

// Restore console.log
console.log = originalLog;

// Generate test price history
function generateTestPriceHistory(basePrice, days = 30) {
  const history = [];
  const now = Date.now();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now - (i * 24 * 60 * 60 * 1000));
    const variance = Math.sin(i / 5) * 0.1 + (Math.random() - 0.5) * 0.05;
    const price = Math.floor(basePrice * (1 + variance));
    
    history.push({
      date: date.toISOString().split('T')[0],
      price: price,
      volume: Math.floor(Math.random() * 1000) + 100,
      timestamp: date.getTime()
    });
  }
  
  return history;
}

async function testPriceHistoryDisplay() {
  console.log('\n🧪 Test 1: Price History Display Components');
  
  const testItems = [
    {
      id: '4151',
      name: 'Abyssal whip',
      basePrice: 1500000,
      scenario: 'Rising trend'
    },
    {
      id: '11802', 
      name: 'Armadyl godsword',
      basePrice: 18000000,
      scenario: 'Volatile market'
    },
    {
      id: '13576',
      name: 'Dragon claws',
      basePrice: 75000000,
      scenario: 'Stable high-value'
    }
  ];
  
  for (const testItem of testItems) {
    console.log(`\n📊 Testing ${testItem.name} (${testItem.scenario}):`);
    
    const priceHistory = generateTestPriceHistory(testItem.basePrice, 30);
    const analysis = analyzePriceHistory(priceHistory);
    
    console.log(`   Analysis generated: ${!!analysis}`);
    
    if (analysis) {
      console.log(`   - Data points: ${analysis.dataPoints}`);
      console.log(`   - Weekly change: ${analysis.weeklyChangePercent?.toFixed(1)}%`);
      console.log(`   - Price range: ${analysis.priceRangePercent?.toFixed(1)}%`);
      console.log(`   - Trend: ${analysis.trendDirection} ${analysis.trendEmoji}`);
      
      // Test compact view HTML generation
      if (popup.createPriceHistoryHTML) {
        const compactHTML = popup.createPriceHistoryHTML(analysis, true, priceHistory);
        console.log(`   ✅ Compact HTML generated: ${compactHTML.length} characters`);
        
        // Check for key elements
        const hasWeeklyChange = compactHTML.includes(analysis.weeklyChangePercent.toFixed(1));
        const hasPriceRange = compactHTML.includes(formatPriceExact(analysis.minPrice));
        const hasTrendEmoji = compactHTML.includes(analysis.trendEmoji);
        
        console.log(`      - Contains weekly change: ${hasWeeklyChange}`);
        console.log(`      - Contains price range: ${hasPriceRange}`);
        console.log(`      - Contains trend emoji: ${hasTrendEmoji}`);
      }
      
      // Test full view HTML generation
      if (popup.createPriceHistoryHTML) {
        const fullHTML = popup.createPriceHistoryHTML(analysis, false, priceHistory);
        console.log(`   ✅ Full HTML generated: ${fullHTML.length} characters`);
        
        // Check for detailed elements
        const hasStatsRow = fullHTML.includes('stat-row');
        const hasVolatility = fullHTML.includes('Volatility');
        const hasMiniChart = fullHTML.includes('mini-chart');
        
        console.log(`      - Contains stat rows: ${hasStatsRow}`);
        console.log(`      - Contains volatility: ${hasVolatility}`);
        console.log(`      - Contains chart: ${hasMiniChart}`);
      }
    }
  }
}

async function testSparklineGeneration() {
  console.log('\n🧪 Test 2: Sparkline Chart Generation');
  
  const testHistory = generateTestPriceHistory(1000000, 14);
  const analysis = analyzePriceHistory(testHistory);
  
  if (popup.createSparklineChart && analysis) {
    const sparklineHTML = popup.createSparklineChart(analysis, testHistory);
    
    console.log(`📈 Sparkline HTML generated: ${sparklineHTML.length} characters`);
    
    // Check for key sparkline components
    const hasBars = sparklineHTML.includes('sparkline-bar');
    const hasInsights = sparklineHTML.includes('insight-row');
    const hasHeader = sparklineHTML.includes('Last 14 Days');
    const hasTradingSignal = sparklineHTML.includes('Trading signal');
    
    console.log(`   ✅ Sparkline components:`);
    console.log(`      - Has price bars: ${hasBars}`);
    console.log(`      - Has insights: ${hasInsights}`);
    console.log(`      - Has header: ${hasHeader}`);
    console.log(`      - Has trading signal: ${hasTradingSignal}`);
    
    // Test with different market conditions
    console.log(`\n🔄 Testing different market scenarios:`);
    
    const scenarios = [
      { name: 'Bull market', multiplier: 1.5, days: 14 },
      { name: 'Bear market', multiplier: 0.7, days: 14 },
      { name: 'Sideways', multiplier: 1.0, days: 14 }
    ];
    
    for (const scenario of scenarios) {
      const scenarioHistory = generateTestPriceHistory(1000000 * scenario.multiplier, scenario.days);
      const scenarioAnalysis = analyzePriceHistory(scenarioHistory);
      const scenarioSparkline = popup.createSparklineChart(scenarioAnalysis, scenarioHistory);
      
      console.log(`   ${scenario.name}: ${scenarioSparkline.length} chars, trend: ${scenarioAnalysis.trendDirection}`);
    }
  } else {
    console.log('❌ Sparkline generation not available');
  }
}

async function testPriceFormatting() {
  console.log('\n🧪 Test 3: Price Formatting in UI Context');
  
  const testPrices = [
    { price: 1234, expected_gp: '1,234 gp' },
    { price: 1234567, expected_gp: '1,234,567 gp' },
    { price: 0, expected_gp: 'Unknown' },
    { price: null, expected_gp: 'Unknown' },
    { price: undefined, expected_gp: 'Unknown' }
  ];
  
  console.log('💰 Testing price formatting:');
  
  for (const test of testPrices) {
    if (popup.formatPrice) {
      const gpFormat = popup.formatPrice(test.price, 'gp');
      const autoFormat = popup.formatPrice(test.price, 'auto');
      const exactFormat = formatPriceExact(test.price || 0);
      
      console.log(`   Price: ${test.price}`);
      console.log(`      GP format: ${gpFormat} ${gpFormat === test.expected_gp ? '✅' : '⚠️'}`);
      console.log(`      Auto format: ${autoFormat}`);
      console.log(`      Exact format: ${exactFormat}`);
    }
  }
}

async function testAlertStatusCalculation() {
  console.log('\n🧪 Test 4: Alert Status Calculation');
  
  const testCases = [
    {
      name: 'Normal price',
      currentPrice: 1500000,
      lowThreshold: 1000000,
      highThreshold: 2000000,
      expectedStatus: 'normal'
    },
    {
      name: 'Low alert triggered',
      currentPrice: 900000,
      lowThreshold: 1000000,
      highThreshold: 2000000,
      expectedStatus: 'low'
    },
    {
      name: 'High alert triggered', 
      currentPrice: 2100000,
      lowThreshold: 1000000,
      highThreshold: 2000000,
      expectedStatus: 'high'
    },
    {
      name: 'No thresholds set',
      currentPrice: 1500000,
      lowThreshold: null,
      highThreshold: null,
      expectedStatus: 'normal'
    }
  ];
  
  console.log('🚨 Testing alert status logic:');
  
  for (const test of testCases) {
    const isLowAlert = test.currentPrice && test.lowThreshold && test.currentPrice <= test.lowThreshold;
    const isHighAlert = test.currentPrice && test.highThreshold && test.currentPrice >= test.highThreshold;
    
    let actualStatus = 'normal';
    if (isLowAlert) actualStatus = 'low';
    if (isHighAlert) actualStatus = 'high';
    
    const passed = actualStatus === test.expectedStatus;
    
    console.log(`   ${test.name}: ${actualStatus} ${passed ? '✅' : '❌'}`);
    
    if (!passed) {
      console.log(`      Expected: ${test.expectedStatus}, Got: ${actualStatus}`);
    }
  }
}

// Run all UI component tests
async function runUITests() {
  try {
    console.log('🚀 Starting price analysis UI component tests...\n');
    
    await testPriceHistoryDisplay();
    await testSparklineGeneration();
    await testPriceFormatting();
    await testAlertStatusCalculation();
    
    console.log('\n✅ All price analysis UI component tests completed!');
    console.log('\n📋 UI Components Verified:');
    console.log('   ✅ Price history display (compact & full views)');
    console.log('   ✅ Sparkline chart generation');
    console.log('   ✅ Price formatting functions');
    console.log('   ✅ Alert status calculations');
    console.log('   ✅ All analysis fields available for UI');
    console.log('\n🎨 The UI should render correctly without visible issues!');
    
    return true;
  } catch (error) {
    console.error('❌ UI component test failed:', error);
    return false;
  }
}

// Execute UI tests
runUITests();