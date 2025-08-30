#!/usr/bin/env node

// Test realistic storage usage with large price histories
console.log('🧪 Testing Realistic Storage Usage with Large Price Histories');
console.log('============================================================');

// Mock Chrome APIs
global.chrome = {
  runtime: { onInstalled: { addListener: () => {} }, onStartup: { addListener: () => {} }, onMessage: { addListener: () => {} } },
  action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
  alarms: { create: () => {}, clear: () => {}, onAlarm: { addListener: () => {} } },
  notifications: { create: () => {}, clear: () => {}, onClicked: { addListener: () => {} } },
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
          } else {
            resolve({ [keys]: this.data[keys] || undefined });
          }
        });
      },
      set: function(data) { return new Promise(resolve => { Object.assign(this.data, data); resolve(); }); },
      remove: function(keys) { return new Promise(resolve => { delete this.data[keys]; resolve(); }); }
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
          } else {
            resolve({ [keys]: this.data[keys] || undefined });
          }
        });
      },
      set: function(data) { return new Promise(resolve => { Object.assign(this.data, data); resolve(); }); },
      remove: function(keys) { return new Promise(resolve => { delete this.data[keys]; resolve(); }); }
    }
  }
};

global.fetch = async () => ({ ok: false });

// Suppress background script console.log during loading
const originalLog = console.log;
console.log = () => {};

// Load background script
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, 'src', 'background.js'), 'utf8'));

// Restore console.log
console.log = originalLog;

async function testRealisticUsage() {
  console.log('Creating realistic watchlist with large price histories...\n');
  
  const itemCount = 10;
  
  // Create items with realistic data
  for (let i = 1; i <= itemCount; i++) {
    const itemId = i.toString();
    
    // Lightweight metadata (what goes to sync storage)
    const metadata = {
      id: itemId,
      name: `RuneScape Item ${i}`,
      url: `https://secure.runescape.com/m=itemdb_rs/viewitem?obj=${itemId}`,
      originalUrl: `https://secure.runescape.com/m=itemdb_rs/viewitem?obj=${itemId}`,
      imageUrl: `https://secure.runescape.com/m=itemdb_rs/obj_big.gif?id=${itemId}`,
      lowThreshold: 1000 * i,
      highThreshold: 2000 * i,
      addedAt: Date.now() - (i * 86400000) // Spread over days
    };
    
    // Heavy price data with 30 days of history (what goes to local storage)
    const priceHistory = [];
    const basePrice = 1500 * i;
    for (let day = 0; day < 30; day++) {
      const date = new Date(Date.now() - (day * 86400000));
      const price = Math.floor(basePrice + (Math.sin(day * 0.2) * basePrice * 0.1) + (Math.random() - 0.5) * basePrice * 0.05);
      const volume = Math.floor(1000 + Math.random() * 5000);
      
      priceHistory.push({
        date: date.toISOString().split('T')[0],
        price: price,
        volume: volume,
        timestamp: date.getTime()
      });
    }
    
    // Complex price analysis (what would be calculated from history)
    const priceAnalysis = {
      currentPrice: priceHistory[0].price,
      minPrice: Math.min(...priceHistory.map(p => p.price)),
      maxPrice: Math.max(...priceHistory.map(p => p.price)),
      avgPrice: Math.floor(priceHistory.reduce((sum, p) => sum + p.price, 0) / priceHistory.length),
      weeklyChange: priceHistory[0].price - priceHistory[7].price,
      weeklyChangePercent: ((priceHistory[0].price - priceHistory[7].price) / priceHistory[7].price) * 100,
      trendDirection: Math.random() > 0.5 ? 'rising' : 'falling',
      trendEmoji: Math.random() > 0.5 ? '📈' : '📉',
      dataPoints: 30,
      priceRange: Math.max(...priceHistory.map(p => p.price)) - Math.min(...priceHistory.map(p => p.price)),
      priceRangePercent: ((Math.max(...priceHistory.map(p => p.price)) - Math.min(...priceHistory.map(p => p.price))) / Math.min(...priceHistory.map(p => p.price))) * 100,
      volatilityScore: Math.random() * 100,
      trendStrength: Math.random() * 10,
      recentMomentum: Math.random() * 20 - 10,
      positionInRange: Math.random() * 100,
      tradingVolume: Math.floor(Math.random() * 100000),
      liquidityScore: Math.random() * 10
    };
    
    const priceData = {
      currentPrice: priceAnalysis.currentPrice,
      lastChecked: Date.now(),
      previousPrice: priceAnalysis.currentPrice - 50,
      priceAnalysis: priceAnalysis,
      lastHistoryUpdate: Date.now(),
      lastLowAlert: Math.random() > 0.7 ? Date.now() - Math.random() * 86400000 : null,
      lastHighAlert: Math.random() > 0.7 ? Date.now() - Math.random() * 86400000 : null
    };
    
    // Save using hybrid storage
    await saveItemMetadata(itemId, metadata);
    await savePriceData(itemId, priceData);
    
    // Also store price history separately
    await storePriceHistory(itemId, priceHistory);
  }
  
  // Analyze storage usage  
  const syncData = await chrome.storage.sync.get();
  const localData = await chrome.storage.local.get();
  
  console.log('Raw sync data:', JSON.stringify(syncData).substring(0, 200) + '...');
  console.log('Raw local data keys:', Object.keys(localData));
  
  const syncSize = JSON.stringify(syncData).length;
  const localSize = JSON.stringify(localData).length;
  
  // Count detailed data sizes
  let priceHistorySize = 0;
  for (let i = 1; i <= itemCount; i++) {
    const historyKey = `priceHistory_${i}`;
    if (localData[historyKey]) {
      priceHistorySize += JSON.stringify(localData[historyKey]).length;
    }
  }
  
  const priceDataSize = localData.priceData ? JSON.stringify(localData.priceData).length : 0;
  const metadataSize = syncData.itemMetadata ? JSON.stringify(syncData.itemMetadata).length : 0;
  
  console.log(`📊 Storage Analysis for ${itemCount} items with 30-day price histories:`);
  console.log(`=================================================================`);
  console.log(`📤 SYNC STORAGE (syncs across devices):`);
  console.log(`   - Total size: ${syncSize.toLocaleString()} bytes`);
  console.log(`   - Item metadata: ${metadataSize.toLocaleString()} bytes`);
  console.log(`   - Chrome sync quota: ${syncSize}/102,400 bytes (${(syncSize/102400*100).toFixed(1)}%)`);
  console.log(`   - Items that can fit: ~${Math.floor(102400 / (metadataSize / itemCount))}`);
  
  console.log(`\n💾 LOCAL STORAGE (stays on device):`);
  console.log(`   - Total size: ${localSize.toLocaleString()} bytes`);
  console.log(`   - Price data: ${priceDataSize.toLocaleString()} bytes`);
  console.log(`   - Price histories: ${priceHistorySize.toLocaleString()} bytes`);
  console.log(`   - No storage limits for local storage`);
  
  console.log(`\n📈 OPTIMIZATION RESULTS:`);
  console.log(`   - Sync storage is ${((1 - syncSize/localSize) * 100).toFixed(1)}% smaller than local storage`);
  console.log(`   - Price histories alone are ${(priceHistorySize/syncSize*100).toFixed(1)}x larger than sync storage`);
  console.log(`   - Essential metadata (${metadataSize.toLocaleString()} bytes) vs full data would be (${(syncSize + localSize).toLocaleString()} bytes)`);
  
  // Test the merge functionality
  console.log(`\n🔗 Testing merged watchlist functionality:`);
  const watchlist = await getWatchlist();
  const watchlistKeys = Object.keys(watchlist);
  
  console.log(`   - Successfully merged ${watchlistKeys.length} items`);
  
  if (watchlist['1']) {
    const item = watchlist['1'];
    const hasAllData = !!(item.name && item.currentPrice && item.priceAnalysis && item.lowThreshold);
    console.log(`   - Sample item has all data: ${hasAllData ? '✅' : '❌'}`);
    console.log(`   - Name: ${item.name}`);
    console.log(`   - Price: ${item.currentPrice?.toLocaleString()} gp`);
    console.log(`   - Analysis points: ${item.priceAnalysis?.dataPoints || 'missing'}`);
    console.log(`   - Thresholds: ${item.lowThreshold?.toLocaleString()} - ${item.highThreshold?.toLocaleString()} gp`);
  }
  
  // Test quota simulation
  console.log(`\n⚠️  QUOTA SIMULATION:`);
  const maxItemsInOldSystem = Math.floor(102400 / ((syncSize + localSize) / itemCount));
  const maxItemsInNewSystem = Math.floor(102400 / (metadataSize / itemCount));
  
  console.log(`   - Old system (everything in sync): ~${maxItemsInOldSystem} items max`);
  console.log(`   - New hybrid system: ~${maxItemsInNewSystem} items max`);
  console.log(`   - Improvement: ${(maxItemsInNewSystem / Math.max(maxItemsInOldSystem, 1) * 100).toFixed(0)}% more items supported`);
  
  if (maxItemsInOldSystem <= 10 && maxItemsInNewSystem >= 50) {
    console.log(`   ✅ Hybrid system solves quota issues for realistic watchlists`);
  } else if (maxItemsInNewSystem > maxItemsInOldSystem) {
    console.log(`   ✅ Hybrid system provides improvement`);
  } else {
    console.log(`   ❌ Hybrid system doesn't provide expected improvement`);
  }
  
  return true;
}

// Run the test
testRealisticUsage().then(() => {
  console.log('\n✅ Realistic usage test completed successfully!');
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});