import dotenv from 'dotenv';
dotenv.config();

import { TOKENS, EVENT_TOPICS, isExchangeAddress, getExchangeName, getEntityLabel } from '../config/constants.js';
import { updateCryptoPrices, getTokenPriceUsd, calculateUsdValue } from '../services/priceService.js';
import { formatAlertMessage, formatCompactUSD, parseThresholdInput } from '../services/telegramBot.js';

async function runTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING COMPREHENSIVE SENTINEL & OPTIMIZATION TESTS');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(cond, name) {
    total++;
    if (cond) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
    }
  }

  // 1. Test Price Service
  console.log('\n--- 1. Testing Price Service ---');
  await updateCryptoPrices();
  const btcPrice = getTokenPriceUsd('BTC');
  const ethPrice = getTokenPriceUsd('ETH');
  const usdtPrice = getTokenPriceUsd('USDT');

  assert(btcPrice > 10000, `BTC price is valid: $${btcPrice.toLocaleString()}`);
  assert(ethPrice > 500, `ETH price is valid: $${ethPrice.toLocaleString()}`);
  assert(usdtPrice === 1.0, 'USDT price is exactly $1.00');

  const ethVal = calculateUsdValue('ETH', 50000);
  assert(ethVal >= 100_000_000, `50,000 ETH value calculated: $${Math.round(ethVal).toLocaleString()} (>= $100M)`);

  // 2. Test Exchange Detection
  console.log('\n--- 2. Testing Exchange Detection ---');
  const binanceEth = '0x28c6c06298d514db089934071355e5743bf21d60';
  const coinbaseEth = '0x503828976d22510aad0201ac7ec88293211d23da';
  const binanceBtc = '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo';
  const randomWallet = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';

  assert(isExchangeAddress(binanceEth), 'Binance ETH address identified as exchange');
  assert(isExchangeAddress(coinbaseEth), 'Coinbase ETH address identified as exchange');
  assert(isExchangeAddress(binanceBtc), 'Binance BTC address identified as exchange');
  assert(!isExchangeAddress(randomWallet), 'Random wallet correctly NOT identified as exchange');
  assert(getExchangeName(binanceEth).includes('Binance'), 'Binance name returned accurately');

  // 3. Test Threshold Parsing & Compact Formatting
  console.log('\n--- 3. Testing Threshold Formatting ---');
  assert(parseThresholdInput('100M') === 100_000_000, 'Parsed 100M = 100,000,000');
  assert(parseThresholdInput('1B') === 1_000_000_000, 'Parsed 1B = 1,000,000,000');
  assert(formatCompactUSD(150_000_000) === '$150M', 'Formatted 150M compact USD');
  assert(formatCompactUSD(1_200_000_000) === '$1.2B', 'Formatted 1.2B compact USD');

  // 4. Test Event Topics
  console.log('\n--- 4. Testing On-Chain Event Topics (Zero-Spam RPC Filter) ---');
  assert(!!EVENT_TOPICS.USDT_ISSUE, 'USDT Issue topic hash exists');
  assert(!!EVENT_TOPICS.USDT_REDEEM, 'USDT Redeem topic hash exists');
  assert(!!EVENT_TOPICS.USDC_MINT, 'USDC Mint topic hash exists');
  assert(!!EVENT_TOPICS.USDC_BURN, 'USDC Burn topic hash exists');

  // 5. Test Alert Formatters for All 4 Categories
  console.log('\n--- 5. Testing Alert Formatters ---');
  
  // A. USDT Mint
  const usdtMintEvent = {
    txHash: '0x32c58611116f1d87e07a34685ff86cb310a08e6840742f534891b97ad8c65f97',
    token: 'USDT',
    eventType: 'MINT',
    amountFormatted: 1000000000,
    valueUsd: 1000000000,
    from: '0x0000000000000000000000000000000000000000',
    to: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
    fromLabel: '🔥 Null / Black Hole',
    toLabel: '🏦 Tether Treasury',
    blockNumber: 25808630,
    network: 'Ethereum',
    timestamp: new Date()
  };
  const usdtMsg = formatAlertMessage(usdtMintEvent);
  assert(usdtMsg.includes('USDT NATIVE MINT') && usdtMsg.includes('$1B'), 'USDT Mint alert contains correct header and amount');

  // B. BTC Inflow (Wallet -> Exchange)
  const btcInflowEvent = {
    txHash: 'a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d',
    token: 'BTC',
    eventType: 'WALLET_TO_EXCHANGE',
    amountFormatted: 2000,
    valueUsd: 130000000,
    from: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    to: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo',
    fromLabel: 'Whale (1A1z...vfNa)',
    toLabel: 'Binance: Cold Storage',
    exchangeName: 'Binance',
    blockNumber: 885120,
    network: 'Bitcoin',
    timestamp: new Date()
  };
  const btcMsg = formatAlertMessage(btcInflowEvent);
  assert(btcMsg.includes('BTC INFLOW: WALLET ➔ EXCHANGE') && btcMsg.includes('$130M'), 'BTC Inflow alert contains correct header and amount');

  // C. ETH Outflow (Exchange -> Wallet)
  const ethOutflowEvent = {
    txHash: '0x4f877c4456950293297a74ea86307137f81498b0a1b2c3d4e5f60718293a4b5c',
    token: 'ETH',
    eventType: 'EXCHANGE_TO_WALLET',
    amountFormatted: 40000,
    valueUsd: 112000000,
    from: binanceEth,
    to: randomWallet,
    fromLabel: 'Binance: Hot Wallet 14',
    toLabel: 'Whale (0xd8da...6045)',
    exchangeName: 'Binance',
    blockNumber: 25808640,
    network: 'Ethereum',
    timestamp: new Date()
  };
  const ethMsg = formatAlertMessage(ethOutflowEvent);
  assert(ethMsg.includes('ETH OUTFLOW: EXCHANGE ➔ WALLET') && ethMsg.includes('$112M'), 'ETH Outflow alert contains correct header and amount');

  console.log(`\n========================================================`);
  console.log(`🎯 TEST RESULTS: ${passed}/${total} PASSED (${Math.round((passed/total)*100)}%)`);
  console.log(`========================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
