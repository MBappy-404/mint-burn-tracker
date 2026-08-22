import { ethers } from 'ethers';
import { TOKENS, CONTRACT_ABIS, EVENT_TOPICS, ZERO_ADDRESS } from '../config/constants.js';
import { logger } from '../config/logger.js';
import { processMintBurnEvent } from './eventProcessor.js';

let httpProvider = null;
let wsProvider = null;
let lastProcessedBlock = 0;
let isPollingActive = false;
let blockTimestampCache = new Map();

// Helper to get block timestamp with in-memory caching
async function getBlockTimestamp(provider, blockNumber) {
  if (blockTimestampCache.has(blockNumber)) {
    return blockTimestampCache.get(blockNumber);
  }
  try {
    const block = await provider.getBlock(blockNumber);
    if (block && block.timestamp) {
      const date = new Date(block.timestamp * 1000);
      blockTimestampCache.set(blockNumber, date);
      if (blockTimestampCache.size > 200) {
        const firstKey = blockTimestampCache.keys().next().value;
        blockTimestampCache.delete(firstKey);
      }
      return date;
    }
  } catch (e) {
    logger.debug(`Failed to fetch timestamp for block ${blockNumber}:`, e.message);
  }
  return new Date();
}

/**
 * Handle Native USDT Contract Events (Tether Official Issue & Redeem ONLY)
 * NO Transfer listener = 0 spam, 0 wasted API traffic!
 */
function setupUsdtListeners(contract, provider) {
  logger.info('📡 Attaching listeners for USDT (Tether Official Mint/Burn Only)...');

  // 1. Issue(uint amount) - Tether Official Mint
  contract.on('Issue', async (amount, eventPayload) => {
    try {
      const amountBigInt = BigInt(amount.toString());
      // Quick filter: 100M USDT (with 6 decimals) = 100,000,000,000,000
      if (amountBigInt < 100_000_000_000_000n) {
        return; // Discard immediately without making extra calls
      }

      const log = eventPayload.log || eventPayload;
      const timestamp = await getBlockTimestamp(provider, log.blockNumber);
      await processMintBurnEvent({
        txHash: log.transactionHash,
        logIndex: log.index ?? 0,
        blockNumber: log.blockNumber,
        timestamp,
        tokenSymbol: 'USDT',
        eventType: 'MINT',
        rawAmount: amount.toString(),
        from: ZERO_ADDRESS,
        to: '0x5754284f345afc66a98fbb0a0afe71e0f007b949', // Tether Treasury
        network: 'Ethereum'
      });
    } catch (err) {
      logger.error('Error handling USDT Issue event:', err.message);
    }
  });

  // 2. Redeem(uint amount) - Tether Official Burn
  contract.on('Redeem', async (amount, eventPayload) => {
    try {
      const amountBigInt = BigInt(amount.toString());
      // Quick filter: 100M USDT = 100,000,000,000,000
      if (amountBigInt < 100_000_000_000_000n) {
        return;
      }

      const log = eventPayload.log || eventPayload;
      const timestamp = await getBlockTimestamp(provider, log.blockNumber);
      await processMintBurnEvent({
        txHash: log.transactionHash,
        logIndex: log.index ?? 0,
        blockNumber: log.blockNumber,
        timestamp,
        tokenSymbol: 'USDT',
        eventType: 'BURN',
        rawAmount: amount.toString(),
        from: '0x5754284f345afc66a98fbb0a0afe71e0f007b949', // Tether Treasury
        to: ZERO_ADDRESS,
        network: 'Ethereum'
      });
    } catch (err) {
      logger.error('Error handling USDT Redeem event:', err.message);
    }
  });
}

/**
 * Handle Native USDC Contract Events (Circle Official Mint & Burn ONLY)
 * NO Transfer listener = 0 spam, 0 wasted API traffic!
 */
function setupUsdcListeners(contract, provider) {
  logger.info('📡 Attaching listeners for USDC (Circle Official Mint/Burn Only)...');

  // 1. Mint(address minter, address to, uint256 amount) - Circle Official Mint
  contract.on('Mint', async (minter, to, amount, eventPayload) => {
    try {
      const amountBigInt = BigInt(amount.toString());
      // Quick filter: 100M USDC = 100,000,000,000,000
      if (amountBigInt < 100_000_000_000_000n) {
        return;
      }

      const log = eventPayload.log || eventPayload;
      const timestamp = await getBlockTimestamp(provider, log.blockNumber);
      await processMintBurnEvent({
        txHash: log.transactionHash,
        logIndex: log.index ?? 0,
        blockNumber: log.blockNumber,
        timestamp,
        tokenSymbol: 'USDC',
        eventType: 'MINT',
        rawAmount: amount.toString(),
        from: (minter || ZERO_ADDRESS).toLowerCase(),
        to: (to || '').toLowerCase(),
        network: 'Ethereum'
      });
    } catch (err) {
      logger.error('Error handling USDC Mint event:', err.message);
    }
  });

  // 2. Burn(address burner, uint256 amount) - Circle Official Burn
  contract.on('Burn', async (burner, amount, eventPayload) => {
    try {
      const amountBigInt = BigInt(amount.toString());
      // Quick filter: 100M USDC = 100,000,000,000,000
      if (amountBigInt < 100_000_000_000_000n) {
        return;
      }

      const log = eventPayload.log || eventPayload;
      const timestamp = await getBlockTimestamp(provider, log.blockNumber);
      await processMintBurnEvent({
        txHash: log.transactionHash,
        logIndex: log.index ?? 0,
        blockNumber: log.blockNumber,
        timestamp,
        tokenSymbol: 'USDC',
        eventType: 'BURN',
        rawAmount: amount.toString(),
        from: (burner || '').toLowerCase(),
        to: ZERO_ADDRESS,
        network: 'Ethereum'
      });
    } catch (err) {
      logger.error('Error handling USDC Burn event:', err.message);
    }
  });
}

/**
 * Initialize Fallback Poller with Strict Topic Filtering (Ultra Low Overhead)
 */
async function startFallbackPoller() {
  if (isPollingActive) return;
  isPollingActive = true;

  const pollInterval = Number(process.env.POLL_INTERVAL_MS) || 15000;
  logger.info(`🔄 Optimized block scanner active (Checking every ${pollInterval / 1000}s with on-chain topic filter)...`);

  const poll = async () => {
    try {
      if (!httpProvider) return;
      const currentBlock = await httpProvider.getBlockNumber();

      if (lastProcessedBlock === 0) {
        lastProcessedBlock = currentBlock - 1;
      }

      if (currentBlock > lastProcessedBlock) {
        const fromBlock = lastProcessedBlock + 1;
        const toBlock = currentBlock;

        // Check USDT logs with strict Issue/Redeem topic filter
        await checkTokenLogs(
          TOKENS.USDT.address,
          CONTRACT_ABIS.USDT,
          'USDT',
          [EVENT_TOPICS.USDT_ISSUE, EVENT_TOPICS.USDT_REDEEM],
          fromBlock,
          toBlock
        );

        // Check USDC logs with strict Mint/Burn topic filter
        await checkTokenLogs(
          TOKENS.USDC.address,
          CONTRACT_ABIS.USDC,
          'USDC',
          [EVENT_TOPICS.USDC_MINT, EVENT_TOPICS.USDC_BURN],
          fromBlock,
          toBlock
        );

        lastProcessedBlock = toBlock;
      }
    } catch (err) {
      logger.warn('Poller cycle warning:', err.message);
    } finally {
      setTimeout(poll, pollInterval);
    }
  };

  poll();
}

/**
 * Query logs with strict server-side topic filtering
 */
export async function checkTokenLogs(contractAddress, abi, symbol, topics, fromBlock, toBlock) {
  try {
    const iface = new ethers.Interface(abi);
    const MAX_CHUNK = 50; // Safe chunk size when topic-filtered

    for (let start = fromBlock; start <= toBlock; start += MAX_CHUNK) {
      const end = Math.min(start + MAX_CHUNK - 1, toBlock);

      const logs = await httpProvider.getLogs({
        address: contractAddress,
        topics: [topics], // Server-side filter: Alchemy returns [] if no mint/burn in range
        fromBlock: start,
        toBlock: end
      });

      for (const log of logs) {
        try {
          const parsed = iface.parseLog(log);
          if (!parsed) continue;

          if (parsed.name === 'Issue') {
            const rawAmount = parsed.args[0].toString();
            if (BigInt(rawAmount) < 100_000_000_000_000n) continue; // >= $100M
            const timestamp = await getBlockTimestamp(httpProvider, log.blockNumber);
            await processMintBurnEvent({
              txHash: log.transactionHash,
              logIndex: log.index ?? 0,
              blockNumber: log.blockNumber,
              timestamp,
              tokenSymbol: symbol,
              eventType: 'MINT',
              rawAmount,
              from: ZERO_ADDRESS,
              to: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
              network: 'Ethereum'
            });
          } else if (parsed.name === 'Redeem') {
            const rawAmount = parsed.args[0].toString();
            if (BigInt(rawAmount) < 100_000_000_000_000n) continue; // >= $100M
            const timestamp = await getBlockTimestamp(httpProvider, log.blockNumber);
            await processMintBurnEvent({
              txHash: log.transactionHash,
              logIndex: log.index ?? 0,
              blockNumber: log.blockNumber,
              timestamp,
              tokenSymbol: symbol,
              eventType: 'BURN',
              rawAmount,
              from: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
              to: ZERO_ADDRESS,
              network: 'Ethereum'
            });
          } else if (parsed.name === 'Mint') {
            const rawAmount = (parsed.args.amount || parsed.args[2]).toString();
            if (BigInt(rawAmount) < 100_000_000_000_000n) continue; // >= $100M
            const timestamp = await getBlockTimestamp(httpProvider, log.blockNumber);
            await processMintBurnEvent({
              txHash: log.transactionHash,
              logIndex: log.index ?? 0,
              blockNumber: log.blockNumber,
              timestamp,
              tokenSymbol: symbol,
              eventType: 'MINT',
              rawAmount,
              from: (parsed.args.minter || parsed.args[0] || ZERO_ADDRESS).toLowerCase(),
              to: (parsed.args.to || parsed.args[1] || '').toLowerCase(),
              network: 'Ethereum'
            });
          } else if (parsed.name === 'Burn') {
            const rawAmount = (parsed.args.amount || parsed.args[1]).toString();
            if (BigInt(rawAmount) < 100_000_000_000_000n) continue; // >= $100M
            const timestamp = await getBlockTimestamp(httpProvider, log.blockNumber);
            await processMintBurnEvent({
              txHash: log.transactionHash,
              logIndex: log.index ?? 0,
              blockNumber: log.blockNumber,
              timestamp,
              tokenSymbol: symbol,
              eventType: 'BURN',
              rawAmount,
              from: (parsed.args.burner || parsed.args[0] || '').toLowerCase(),
              to: ZERO_ADDRESS,
              network: 'Ethereum'
            });
          }
        } catch (parseErr) {
          // Ignore non-matching logs
        }
      }
    }
  } catch (err) {
    logger.debug(`Error fetching logs for ${symbol}:`, err.message);
  }
}

/**
 * Initialize Blockchain Listener with WebSocket & HTTP Providers
 */
export async function initBlockchainListener() {
  const httpUrl = process.env.ALCHEMY_HTTP_URL;
  const wssUrl = process.env.ALCHEMY_WSS_URL;

  if (!httpUrl) {
    throw new Error('ALCHEMY_HTTP_URL is missing in environment config');
  }

  // 1. Initialize HTTP Provider
  httpProvider = new ethers.JsonRpcProvider(httpUrl);
  const network = await httpProvider.getNetwork();
  const currentBlock = await httpProvider.getBlockNumber();
  lastProcessedBlock = currentBlock;

  logger.info(` Connected to Alchemy Ethereum RPC (Chain ID: ${network.chainId}, Current Block: #${currentBlock.toLocaleString()})`);

  // 2. Initialize WebSocket Provider if available
  if (wssUrl) {
    try {
      wsProvider = new ethers.WebSocketProvider(wssUrl);
      
      const usdtContract = new ethers.Contract(TOKENS.USDT.address, CONTRACT_ABIS.USDT, wsProvider);
      const usdcContract = new ethers.Contract(TOKENS.USDC.address, CONTRACT_ABIS.USDC, wsProvider);

      // Listen ONLY to native Mint & Burn events
      setupUsdtListeners(usdtContract, wsProvider);
      setupUsdcListeners(usdcContract, wsProvider);

      wsProvider.websocket.on('close', (code) => {
        logger.warn(` Alchemy WebSocket closed (code ${code}). Reconnecting in 5s...`);
        setTimeout(initBlockchainListener, 5000);
      });

      wsProvider.websocket.on('error', (err) => {
        logger.error(' Alchemy WebSocket error:', err.message);
      });

      logger.info('⚡ Alchemy WebSocket stream active for Native USDT & USDC Mints/Burns!');
    } catch (wsErr) {
      logger.warn(' WebSocket initialization warning (Fallback poller will handle events):', wsErr.message);
    }
  }

  // 3. Start Fallback Poller with server-side topic filtering
  startFallbackPoller();

  return { httpProvider, wsProvider };
}

export function getListenerStatus() {
  return {
    lastProcessedBlock,
    isHttpConnected: !!httpProvider,
    isWsConnected: !!wsProvider
  };
}
