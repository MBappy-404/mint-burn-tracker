import { logger } from '../config/logger.js';

// Cached crypto prices in USD
let cachedPrices = {
  BTC: 65000,
  ETH: 2800,
  USDT: 1.0,
  USDC: 1.0,
  lastUpdated: 0
};

const PRICE_CACHE_TTL_MS = 60000; // Refresh once every 60 seconds (1 request per minute)

/**
 * Fetch latest BTC and ETH prices from free public ticker
 */
export async function updateCryptoPrices() {
  const now = Date.now();
  if (now - cachedPrices.lastUpdated < PRICE_CACHE_TTL_MS && cachedPrices.lastUpdated !== 0) {
    return cachedPrices;
  }

  try {
    // 1. Primary endpoint: Binance Public Ticker (Fast, Free, No Auth)
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT"]');
    if (res.ok) {
      const data = await res.json();
      for (const item of data) {
        if (item.symbol === 'BTCUSDT') {
          cachedPrices.BTC = parseFloat(item.price);
        } else if (item.symbol === 'ETHUSDT') {
          cachedPrices.ETH = parseFloat(item.price);
        }
      }
      cachedPrices.lastUpdated = now;
      logger.debug(`💰 Crypto Prices Updated: BTC = $${cachedPrices.BTC.toLocaleString()} | ETH = $${cachedPrices.ETH.toLocaleString()}`);
      return cachedPrices;
    }
  } catch (err) {
    logger.debug('Binance price fetch notice, trying CoinGecko fallback:', err.message);
  }

  try {
    // 2. Fallback endpoint: CoinGecko Simple Price
    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
    if (cgRes.ok) {
      const cgData = await cgRes.json();
      if (cgData.bitcoin?.usd) cachedPrices.BTC = cgData.bitcoin.usd;
      if (cgData.ethereum?.usd) cachedPrices.ETH = cgData.ethereum.usd;
      cachedPrices.lastUpdated = now;
      return cachedPrices;
    }
  } catch (cgErr) {
    logger.debug('CoinGecko fallback notice:', cgErr.message);
  }

  return cachedPrices;
}

/**
 * Initialize price refresher timer
 */
export function initPriceService() {
  updateCryptoPrices();
  setInterval(updateCryptoPrices, PRICE_CACHE_TTL_MS);
  logger.info('📊 Crypto Price Service active (Cached 60s ticker for BTC & ETH)');
}

/**
 * Get current cached USD price for a token
 */
export function getTokenPriceUsd(symbol) {
  const sym = symbol?.toUpperCase();
  if (sym === 'USDT' || sym === 'USDC') return 1.0;
  return cachedPrices[sym] || (sym === 'BTC' ? 65000 : 2800);
}

/**
 * Convert token amount to exact USD valuation
 */
export function calculateUsdValue(symbol, tokenAmount) {
  const price = getTokenPriceUsd(symbol);
  return tokenAmount * price;
}
