import { ethers } from 'ethers';
import { KNOWN_EXCHANGES, KNOWN_BTC_EXCHANGES, isExchangeAddress, getExchangeName, getEntityLabel } from '../config/constants.js';
import { logger } from '../config/logger.js';
import { getTokenPriceUsd, calculateUsdValue } from './priceService.js';
import { processWhaleTransaction } from './eventProcessor.js';

let lastProcessedEthBlock = 0;
let lastProcessedBtcHeight = 0;
let isEthScanning = false;
let isBtcScanning = false;

/**
 * Scan an Ethereum block for large native ETH transfers (>= $100M)
 */
export async function scanEthBlockForWhaleTxs(provider, blockNumber) {
  if (!provider || !blockNumber) return;

  try {
    const ethPrice = getTokenPriceUsd('ETH');
    // Minimum ETH needed to reach $100 Million USD
    const minEthFor100M = 100_000_000 / (ethPrice || 2800);

    const block = await provider.getBlock(blockNumber, true);
    if (!block || !block.prefetchedTransactions) return;

    for (const tx of block.prefetchedTransactions) {
      if (!tx || !tx.value) continue;

      const valueEth = parseFloat(ethers.formatEther(tx.value));
      const valueUsd = valueEth * ethPrice;

      // STRICT USER RULE: Only process transactions >= $100,000,000 USD
      if (valueUsd < 100_000_000) {
        continue;
      }

      const fromLower = (tx.from || '').toLowerCase();
      const toLower = (tx.to || '').toLowerCase();
      if (!fromLower || !toLower) continue;

      const fromIsExchange = isExchangeAddress(fromLower);
      const toIsExchange = isExchangeAddress(toLower);

      // STRICT USER RULE: Only Wallet-to-Exchange or Exchange-to-Wallet
      if (fromIsExchange && !toIsExchange) {
        // Exchange Outflow / Withdrawal
        await processWhaleTransaction({
          txHash: tx.hash,
          logIndex: 0,
          blockNumber: block.number,
          timestamp: new Date(block.timestamp * 1000),
          tokenSymbol: 'ETH',
          eventType: 'EXCHANGE_TO_WALLET',
          cryptoAmount: valueEth,
          valueUsd,
          from: fromLower,
          to: toLower,
          fromLabel: getExchangeName(fromLower) || 'Exchange Wallet',
          toLabel: getEntityLabel(toLower),
          exchangeName: getExchangeName(fromLower) || 'Unknown Exchange',
          network: 'Ethereum'
        });
      } else if (!fromIsExchange && toIsExchange) {
        // Exchange Inflow / Deposit
        await processWhaleTransaction({
          txHash: tx.hash,
          logIndex: 0,
          blockNumber: block.number,
          timestamp: new Date(block.timestamp * 1000),
          tokenSymbol: 'ETH',
          eventType: 'WALLET_TO_EXCHANGE',
          cryptoAmount: valueEth,
          valueUsd,
          from: fromLower,
          to: toLower,
          fromLabel: getEntityLabel(fromLower),
          toLabel: getExchangeName(toLower) || 'Exchange Wallet',
          exchangeName: getExchangeName(toLower) || 'Unknown Exchange',
          network: 'Ethereum'
        });
      }
      // If both are exchanges (internal rebalance) or neither is an exchange -> Ignored!
    }
  } catch (err) {
    logger.debug(`ETH whale scanner notice for block ${blockNumber}:`, err.message);
  }
}

// Helper to fetch from Bitcoin explorer with fallback & timeout
async function fetchBtcApi(endpoint) {
  const providers = [
    'https://blockstream.info/api',
    'https://mempool.space/api'
  ];

  for (const base of providers) {
    try {
      const res = await fetch(`${base}${endpoint}`, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'MintFather/1.0' }
      });
      if (res.ok) {
        return res;
      }
    } catch (e) {
      // Try next provider
    }
  }
  return null;
}

/**
 * Scan a Bitcoin Block for major transactions (>= $100M)
 */
export async function checkRecentBtcBlocks() {
  if (isBtcScanning) return;
  isBtcScanning = true;

  try {
    const btcPrice = getTokenPriceUsd('BTC');
    // 1. Fetch current Bitcoin Tip Height (lightweight HTTP request with fallback)
    const tipRes = await fetchBtcApi('/blocks/tip/height');
    if (!tipRes) {
      isBtcScanning = false;
      return;
    }
    const currentTipHeight = parseInt(await tipRes.text(), 10);
    if (isNaN(currentTipHeight) || currentTipHeight <= 0) {
      isBtcScanning = false;
      return;
    }

    if (!lastProcessedBtcHeight) {
      lastProcessedBtcHeight = currentTipHeight - 1;
      logger.info(`🟧 Bitcoin Tracker synced to Block #${currentTipHeight.toLocaleString()}`);
      isBtcScanning = false;
      return;
    }

    if (currentTipHeight > lastProcessedBtcHeight) {
      for (let height = lastProcessedBtcHeight + 1; height <= currentTipHeight; height++) {
        // Fetch block hash
        const hashRes = await fetchBtcApi(`/block-height/${height}`);
        if (!hashRes) continue;
        const blockHash = (await hashRes.text()).trim();
        if (!blockHash) continue;

        // Fetch block transactions
        const txsRes = await fetchBtcApi(`/block/${blockHash}/txs/0`);
        if (!txsRes) continue;
        const txs = await txsRes.json();
        if (!Array.isArray(txs)) continue;

        for (const tx of txs) {
          if (!tx.vout || !tx.vin) continue;

          // Calculate total output value in satoshis
          const totalSatoshis = tx.vout.reduce((sum, v) => sum + (v.value || 0), 0);
          const btcAmount = totalSatoshis / 100_000_000;
          const valueUsd = btcAmount * btcPrice;

          // Minimum threshold check
          const minThreshold = Number(process.env.DEFAULT_MIN_THRESHOLD_USD) || 100_000_000;
          if (valueUsd < minThreshold) {
            continue;
          }

          // Check inputs and outputs for known exchange addresses
          const inputAddresses = tx.vin.map(i => i.prevout?.scriptpubkey_address).filter(Boolean);
          const outputAddresses = tx.vout.map(o => o.scriptpubkey_address).filter(Boolean);

          const fromExchange = inputAddresses.find(addr => isExchangeAddress(addr));
          const toExchange = outputAddresses.find(addr => isExchangeAddress(addr));

          const firstInput = inputAddresses[0] || 'Unknown Bitcoin Address';
          const firstOutput = outputAddresses[0] || 'Unknown Bitcoin Address';

          if (fromExchange && !toExchange) {
            // Bitcoin Exchange Withdrawal
            await processWhaleTransaction({
              txHash: tx.txid,
              logIndex: 0,
              blockNumber: height,
              timestamp: new Date((tx.status?.block_time || Date.now() / 1000) * 1000),
              tokenSymbol: 'BTC',
              eventType: 'EXCHANGE_TO_WALLET',
              cryptoAmount: btcAmount,
              valueUsd,
              from: firstInput,
              to: firstOutput,
              fromLabel: getExchangeName(fromExchange) || 'Exchange Wallet',
              toLabel: getEntityLabel(firstOutput),
              exchangeName: getExchangeName(fromExchange) || 'Bitcoin Exchange',
              network: 'Bitcoin'
            });
          } else if (!fromExchange && toExchange) {
            // Bitcoin Exchange Deposit
            await processWhaleTransaction({
              txHash: tx.txid,
              logIndex: 0,
              blockNumber: height,
              timestamp: new Date((tx.status?.block_time || Date.now() / 1000) * 1000),
              tokenSymbol: 'BTC',
              eventType: 'WALLET_TO_EXCHANGE',
              cryptoAmount: btcAmount,
              valueUsd,
              from: firstInput,
              to: firstOutput,
              fromLabel: getEntityLabel(firstInput),
              toLabel: getExchangeName(toExchange) || 'Exchange Wallet',
              exchangeName: getExchangeName(toExchange) || 'Bitcoin Exchange',
              network: 'Bitcoin'
            });
          }
        }
      }
      lastProcessedBtcHeight = currentTipHeight;
    }
  } catch (err) {
    logger.debug('Bitcoin block scanner notice:', err.message);
  } finally {
    isBtcScanning = false;
  }
}

/**
 * Initialize BTC & ETH Exchange Whale Sentinel
 */
export function initExchangeTracker(ethProvider) {
  logger.info('🛡️ Initializing Whale Exchange Tracker for BTC & ETH (Threshold: >= $100M USD)...');

  // 1. Bitcoin Poller: checks once every 45 seconds (ultra-low overhead, 80 calls/hour)
  checkRecentBtcBlocks();
  setInterval(checkRecentBtcBlocks, 45000);

  // 2. Ethereum Block Scanner: checks when new ETH blocks arrive
  if (ethProvider) {
    ethProvider.on('block', async (blockNumber) => {
      try {
        await scanEthBlockForWhaleTxs(ethProvider, blockNumber);
      } catch (e) {
        logger.debug('ETH block whale scan notice:', e.message);
      }
    });
  }
}
