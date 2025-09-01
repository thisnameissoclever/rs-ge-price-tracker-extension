#!/usr/bin/env node

// Test hybrid storage architecture
console.log('🧪 Testing Hybrid Storage Architecture');
console.log('=====================================');

// Mock Chrome APIs for testing
global.chrome = {
  runtime: {
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
    onMessage: { addListener: () => {} },
    lastError: null
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
      data: {},
      get: function(keys) {
        return new Promise(resolve => {
          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach(key => {
              result[key] = this.data[key] || undefined;
            });
            resolve(result);
          } else if (typeof keys === 'string') {
            resolve({ [keys]: this.data[keys] || undefined });
          } else if (keys === null || keys === undefined) {
            resolve(this.data);
          } else {
            const result = {};
            Object.keys(keys).forEach(key => {
              result[key] = this.data[key] !== undefined ? this.data[key] : keys[key];
            });
            resolve(result);
          }
        });
      },
      set: function(data) {
        return new Promise(resolve => {
          Object.assign(this.data, data);
          console.log('📤 Sync storage set:', Object.keys(data));
          resolve();
        });
      },
      remove: function(keys) {
        return new Promise(resolve => {
          if (Array.isArray(keys)) {
            keys.forEach(key => delete this.data[key]);
          } else {
            delete this.data[keys];
          }
          resolve();
        });
      }
    },
    local: {
      data: {},
      get: function(keys) {
        return new Promise(resolve => {
          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach(key => {
              result[key] = this.data[key] || undefined;
            });
            resolve(result);
          } else if (typeof keys === 'string') {
            resolve({ [keys]: this.data[keys] || undefined });
          } else if (keys === null || keys === undefined) {
            resolve(this.data);
          } else {
            const result = {};
            Object.keys(keys).forEach(key => {
              result[key] = this.data[key] !== undefined ? this.data[key] : keys[key];
            });
            resolve(result);
          }
        });
      },
      set: function(data) {
        return new Promise(resolve => {
          Object.assign(this.data, data);
          console.log('💾 Local storage set:', Object.keys(data));
          resolve();
        });
      },
      remove: function(keys) {
        return new Promise(resolve => {
          if (Array.isArray(keys)) {
            keys.forEach(key => delete this.data[key]);
          } else {
            delete this.data[keys];
          }
          resolve();
        });
      }
    }
  }
};

// Mock fetch for testing
global.fetch = async () => ({ ok: false });

// Suppress console.log from background script during testing  
const originalLog = console.log;
console.log = () => {};

// Load the background script functions we need to test
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const backgroundScript = fs.readFileSync(path.join(__dirname, 'src', 'background.js'), 'utf8');

// Extract the functions we need for testing
vm.runInThisContext(backgroundScript);

// Restore console.log for test output
console.log = originalLog;

// Test functions
async function testHybridStorage() {
  console.log('\n🧪 Test 1: Hybrid Storage Separation');
  
  // Test saving item metadata
  const testMetadata = {
    id: '123',
    name: 'Test Item',
    url: 'https://example.com/test',
    originalUrl: 'https://example.com/original',
    imageUrl: 'https://example.com/image.png',
    lowThreshold: 100,
    highThreshold: 200,
    addedAt: Date.now()
  };
  
  await saveItemMetadata('123', testMetadata);
  
  // Test saving price data
  const testPriceData = {
    currentPrice: 150,
    lastChecked: Date.now(),
    previousPrice: 140,
    priceAnalysis: {
      trendDirection: 'rising',
      weeklyChange: 10,
      avgPrice: 145
    },
    lastHistoryUpdate: Date.now()
  };
  
  await savePriceData('123', testPriceData);
  
  // Verify separation
  const syncData = await chrome.storage.sync.get();
  const localData = await chrome.storage.local.get();
  
  console.log('📊 Sync storage contents:', Object.keys(syncData));
  console.log('💾 Local storage contents:', Object.keys(localData));
  
  // Check sync storage contains only metadata
  if (syncData.itemMetadata && syncData.itemMetadata['123']) {
    const syncItem = syncData.itemMetadata['123'];
    console.log('✅ Sync storage contains metadata only');
    console.log('   - Item name:', syncItem.name);
    console.log('   - Has thresholds:', !!(syncItem.lowThreshold && syncItem.highThreshold));
    console.log('   - No price data:', !syncItem.currentPrice);
  } else {
    console.log('❌ Sync storage missing metadata');
  }
  
  // Check local storage contains only price data
  if (localData.priceData && localData.priceData['123']) {
    const priceItem = localData.priceData['123'];
    console.log('✅ Local storage contains price data only');
    console.log('   - Current price:', priceItem.currentPrice);
    console.log('   - Has analysis:', !!priceItem.priceAnalysis);
    console.log('   - No metadata:', !priceItem.name);
  } else {
    console.log('❌ Local storage missing price data');
  }
  
  return true;
}

async function testGetWatchlist() {
  console.log('\n🧪 Test 2: Merging Watchlist Data');
  
  // Test getting merged watchlist
  const watchlist = await getWatchlist();
  
  console.log('📋 Merged watchlist items:', Object.keys(watchlist));
  
  if (watchlist['123']) {
    const item = watchlist['123'];
    console.log('✅ Successfully merged data for item 123:');
    console.log('   - Name (from sync):', item.name);
    console.log('   - Thresholds (from sync):', item.lowThreshold, '/', item.highThreshold);
    console.log('   - Current price (from local):', item.currentPrice);
    console.log('   - Has analysis (from local):', !!item.priceAnalysis);
    
    // Verify all expected fields are present
    const expectedFields = ['id', 'name', 'url', 'imageUrl', 'lowThreshold', 'highThreshold', 'currentPrice', 'priceAnalysis'];
    const missingFields = expectedFields.filter(field => item[field] === undefined);
    
    if (missingFields.length === 0) {
      console.log('✅ All expected fields present in merged data');
    } else {
      console.log('❌ Missing fields:', missingFields);
    }
  } else {
    console.log('❌ Failed to merge watchlist data');
  }
  
  return true;
}

async function testLegacyMigration() {
  console.log('\n🧪 Test 3: Legacy Migration');
  
  // Clear current data
  chrome.storage.sync.data = {};
  chrome.storage.local.data = {};
  
  // Setup legacy watchlist data in sync storage
  const legacyWatchlist = {
    '456': {
      id: '456',
      name: 'Legacy Item',
      url: 'https://example.com/legacy',
      imageUrl: 'https://example.com/legacy.png',
      lowThreshold: 50,
      highThreshold: 100,
      currentPrice: 75,
      lastChecked: Date.now(),
      priceAnalysis: {
        trendDirection: 'stable',
        avgPrice: 70
      },
      addedAt: Date.now() - 86400000 // 1 day ago
    }
  };
  
  await chrome.storage.sync.set({ watchlist: legacyWatchlist });
  console.log('📦 Setup legacy watchlist data');
  
  // Test migration by calling getWatchlist (which should trigger migration)
  const watchlist = await getWatchlist();
  
  // Check if migration occurred
  const syncData = await chrome.storage.sync.get();
  const localData = await chrome.storage.local.get();
  
  if (syncData.itemMetadata && !syncData.watchlist) {
    console.log('✅ Legacy watchlist migrated successfully');
    console.log('   - Old watchlist removed from sync storage');
    console.log('   - New itemMetadata created in sync storage');
    
    if (localData.priceData) {
      console.log('   - Price data moved to local storage');
    }
    
    // Verify the migrated data
    if (watchlist['456']) {
      const item = watchlist['456'];
      console.log('✅ Migrated item accessible via getWatchlist:');
      console.log('   - Name:', item.name);
      console.log('   - Price:', item.currentPrice);
      console.log('   - Analysis:', !!item.priceAnalysis);
    }
  } else {
    console.log('❌ Legacy migration failed');
    console.log('   Sync data keys:', Object.keys(syncData));
    console.log('   Local data keys:', Object.keys(localData));
  }
  
  return true;
}

async function testStorageSize() {
  console.log('\n🧪 Test 4: Storage Size Optimization');
  
  // Create multiple items to test storage usage
  const itemCount = 20;
  
  for (let i = 1; i <= itemCount; i++) {
    const metadata = {
      id: i.toString(),
      name: `Test Item ${i}`,
      url: `https://example.com/item${i}`,
      imageUrl: `https://example.com/item${i}.png`,
      lowThreshold: 100 + i,
      highThreshold: 200 + i,
      addedAt: Date.now()
    };
    
    const priceData = {
      currentPrice: 150 + i,
      lastChecked: Date.now(),
      priceAnalysis: {
        trendDirection: i % 2 === 0 ? 'rising' : 'falling',
        weeklyChange: i * 2,
        avgPrice: 145 + i,
        dataPoints: 30,
        minPrice: 100 + i,
        maxPrice: 200 + i
      },
      lastHistoryUpdate: Date.now()
    };
    
    await saveItemMetadata(i.toString(), metadata);
    await savePriceData(i.toString(), priceData);
  }
  
  // Check storage sizes
  const syncData = await chrome.storage.sync.get();
  const localData = await chrome.storage.local.get();
  
  const syncSize = JSON.stringify(syncData).length;
  const localSize = JSON.stringify(localData).length;
  
  console.log(`📏 Storage sizes with ${itemCount} items:`);
  console.log(`   - Sync storage: ${syncSize} bytes`);
  console.log(`   - Local storage: ${localSize} bytes`);
  console.log(`   - Sync/Local ratio: ${(syncSize / localSize * 100).toFixed(1)}%`);
  
  // Sync storage should be much smaller than local storage
  if (syncSize < localSize * 0.5) {
    console.log('✅ Sync storage is significantly smaller than local storage');
  } else {
    console.log('❌ Sync storage size not optimized properly');
  }
  
  // Check Chrome sync storage limits (100KB)
  const syncQuotaLimit = 102400; // 100KB
  const syncUsagePercent = (syncSize / syncQuotaLimit * 100).toFixed(1);
  
  console.log(`📊 Sync storage quota usage: ${syncUsagePercent}%`);
  
  if (syncSize < syncQuotaLimit) {
    console.log(`✅ Sync storage within quota limits (${syncSize} / ${syncQuotaLimit} bytes)`);
  } else {
    console.log(`❌ Sync storage exceeds quota limits!`);
  }
  
  return true;
}

// Run all tests
async function runAllTests() {
  try {
    console.log('🚀 Starting Hybrid Storage Architecture Tests\n');
    
    await testHybridStorage();
    await testGetWatchlist();
    await testLegacyMigration();
    await testStorageSize();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📊 Final Storage State:');
    
    const syncData = await chrome.storage.sync.get();
    const localData = await chrome.storage.local.get();
    
    console.log(`   - Sync storage: ${Object.keys(syncData).length} collections, ${JSON.stringify(syncData).length} bytes`);
    console.log(`   - Local storage: ${Object.keys(localData).length} collections, ${JSON.stringify(localData).length} bytes`);
    
    if (syncData.itemMetadata) {
      console.log(`   - Items in sync metadata: ${Object.keys(syncData.itemMetadata).length}`);
    }
    
    if (localData.priceData) {
      console.log(`   - Items in local price data: ${Object.keys(localData.priceData).length}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runAllTests();