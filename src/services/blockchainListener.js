import { ethers } from 'ethers';
import { TOKENS, CONTRACT_ABIS, ZERO_ADDRESS } from '../config/constants.js';
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
      // Keep cache small
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
 * Handle USDT Contract Events
 */
function setupUsdtListeners(contract, provider) {
  logger.info('📡 Attaching listeners for USDT (Tether)...');

  // 1. Issue(uint amount) - Tether Mint
  contract.on('Issue', async (amount, eventPayload) => {
    try {
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

  // 2. Redeem(uint amount) - Tether Burn
  contract.on('Redeem', async (amount, eventPayload) => {
    try {
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

  // 3. Transfer from/to Zero Address
  contract.on('Transfer', async (from, to, value, eventPayload) => {
    try {
      const log = eventPayload.log || eventPayload;
      const fromLower = (from || '').toLowerCase();
      const toLower = (to || '').toLowerCase();

      const TETHER_TREASURY_1 = '0x5754284f345afc66a98fbb0a0afe71e0f007b949';
      const TETHER_TREASURY_2 = '0xc6cde7c39eb2f0f0095f41570af89efc2c1ea86e';
      const isTreasury = fromLower === TETHER_TREASURY_1 || fromLower === TETHER_TREASURY_2 || toLower === TETHER_TREASURY_1 || toLower === TETHER_TREASURY_2;

      if (fromLower === ZERO_ADDRESS) {
        const timestamp = await getBlockTimestamp(provider, log.blockNumber);
        await processMintBurnEvent({
          txHash: log.transactionHash,
          logIndex: log.index ?? 0,
          blockNumber: log.blockNumber,
          timestamp,
          tokenSymbol: 'USDT',
          eventType: 'MINT',
          rawAmount: value.toString(),
          from: ZERO_ADDRESS,
          to: toLower,
          network: 'Ethereum'
        });
      } else if (toLower === ZERO_ADDRESS) {
        const timestamp = await getBlockTimestamp(provider, log.blockNumber);
        await processMintBurnEvent({
          txHash: log.transactionHash,
          logIndex: log.index ?? 0,
          blockNumber: log.blockNumber,
          timestamp,
          tokenSymbol: 'USDT',
          eventType: 'BURN',
          rawAmount: value.toString(),
          from: fromLower,
          to: ZERO_ADDRESS,
          network: 'Ethereum'
        });
      } else if (isTreasury && BigInt(value.toString()) >= 100000000000n) { // >= $100,000 USDT
        const timestamp = await getBlockTimestamp(provider, log.blockNumber);
        await processMintBurnEvent({
          txHash: log.transactionHash,
          logIndex: log.index ?? 0,
          blockNumber: log.blockNumber,
          timestamp,
          tokenSymbol: 'USDT',
          eventType: 'TREASURY_TRANSFER',
          rawAmount: value.toString(),
          from: fromLower,
          to: toLower,
          network: 'Ethereum'
        });
      } else if (BigInt(value.toString()) >= 5000000000000n) { // >= $5,000,000 USDT Whale
        const timestamp = await getBlockTimestamp(provider, log.blockNumber);
        await processMintBurnEvent({
          txHash: log.transactionHash,
          logIndex: log.index ?? 0,
          blockNumber: log.blockNumber,
          timestamp,
          tokenSymbol: 'USDT',
          eventType: 'WHALE_TRANSFER',
          rawAmount: value.toString(),
          from: fromLower,
          to: toLower,
          network: 'Ethereum'
        });
      }
    } catch (err) {
      logger.error('Error handling USDT Transfer event:', err.message);
    }
  });
}

/**
 * Handle USDC Contract Events
 */
function setupUsdcListeners(contract, provider) {
  logger.info('📡 Attaching listeners for USDC (Circle)...');

  // 1. Mint(address indexed minter, address indexed to, uint256 amount)
  contract.on('Mint', async (minter, to, amount, eventPayload) => {
    try {
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

  // 2. Burn(address indexed burner, uint256 amount)
  contract.on('Burn', async (burner, amount, eventPayload) => {
    try {
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

  // 3. Transfer from/to Zero Address or Whale moves
  contract.on('Transfer', async (from, to, value, eventPayload) => {
    try {
      const log = eventPayload.log || eventPayload;
      const fromLower = (from || '').toLowerCase();
      const toLower = (to || '').toLowerCase();
      const CIRCLE_MINTER = '0x55fe002a30f5c73e9504b7b72ed222a00461b018';
      const isCircleTreasury = fromLower === CIRCLE_MINTER || toLower === CIRCLE_MINTER;

      if (fromLower === ZERO_ADDRESS) {
        const timestamp = await getBlockTimestamp(provider, log.blockNumber);
        await processMintBurnEvent({
          txHash: log.transactionHash,
          logIndex: log.index ?? 0,
          blockNumber: log.blockNumber,
          timestamp,
          tokenSymbol: 'USDC',
          eventType: 'MINT',
          rawAmount: value.toString(),
          from: ZERO_ADDRESS,
          to: toLower,
          network: 'Ethereum'
        });
      } else if (toLower === ZERO_ADDRESS) {
        const timestamp = await getBlockTimestamp(provider, log.blockNumber);
        await processMintBurnEvent({
          txHash: log.transactionHash,
          logIndex: log.index ?? 0,
          blockNumber: log.blockNumber,
          timestamp,
          tokenSymbol: 'USDC',
          eventType: 'BURN',
          rawAmount: value.toString(),
          from: fromLower,
          to: ZERO_ADDRESS,
          network: 'Ethereum'
        });
      } else if (isCircleTreasury && BigInt(value.toString()) >= 100000000000n) { // >= $100,000 USDC
        const timestamp = await getBlockTimestamp(provider, log.blockNumber);
        await processMintBurnEvent({
          txHash: log.transactionHash,
          logIndex: log.index ?? 0,
          blockNumber: log.blockNumber,
          timestamp,
          tokenSymbol: 'USDC',
          eventType: 'TREASURY_TRANSFER',
          rawAmount: value.toString(),
          from: fromLower,
          to: toLower,
          network: 'Ethereum'
        });
      } else if (BigInt(value.toString()) >= 5000000000000n) { // >= $5,000,000 USDC Whale
        const timestamp = await getBlockTimestamp(provider, log.blockNumber);
        await processMintBurnEvent({
          txHash: log.transactionHash,
          logIndex: log.index ?? 0,
          blockNumber: log.blockNumber,
          timestamp,
          tokenSymbol: 'USDC',
          eventType: 'WHALE_TRANSFER',
          rawAmount: value.toString(),
          from: fromLower,
          to: toLower,
          network: 'Ethereum'
        });
      }
    } catch (err) {
      logger.error('Error handling USDC Transfer event:', err.message);
    }
  });
}

/**
 * Initialize Fallback Poller for Ethereum Blocks
 */
async function startFallbackPoller() {
  if (isPollingActive) return;
  isPollingActive = true;

  const pollInterval = Number(process.env.POLL_INTERVAL_MS) || 12000;
  logger.info(`🔄 Fallback block scanner active (Checking every ${pollInterval / 1000}s)...`);

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

        logger.debug(`🔍 Scanning blocks ${fromBlock} to ${toBlock} for events...`);

        // Check USDT logs
        await checkTokenLogs(
          TOKENS.USDT.address,
          CONTRACT_ABIS.USDT,
          'USDT',
          fromBlock,
          toBlock
        );

        // Check USDC logs
        await checkTokenLogs(
          TOKENS.USDC.address,
          CONTRACT_ABIS.USDC,
          'USDC',
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
 * Query historical or missed logs for a specific token contract with <= 10 block chunking
 */
export async function checkTokenLogs(contractAddress, abi, symbol, fromBlock, toBlock) {
  try {
    const iface = new ethers.Interface(abi);
    const MAX_CHUNK = 10; // Alchemy Free Tier maximum range

    for (let start = fromBlock; start <= toBlock; start += MAX_CHUNK) {
      const end = Math.min(start + MAX_CHUNK - 1, toBlock);

      const logs = await httpProvider.getLogs({
        address: contractAddress,
        fromBlock: start,
        toBlock: end
      });

      for (const log of logs) {
        try {
          const parsed = iface.parseLog(log);
          if (!parsed) continue;

          const timestamp = await getBlockTimestamp(httpProvider, log.blockNumber);

          if (parsed.name === 'Issue') {
            await processMintBurnEvent({
              txHash: log.transactionHash,
              logIndex: log.index ?? 0,
              blockNumber: log.blockNumber,
              timestamp,
              tokenSymbol: symbol,
              eventType: 'MINT',
              rawAmount: parsed.args[0].toString(),
              from: ZERO_ADDRESS,
              to: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
              network: 'Ethereum'
            });
          } else if (parsed.name === 'Redeem') {
            await processMintBurnEvent({
              txHash: log.transactionHash,
              logIndex: log.index ?? 0,
              blockNumber: log.blockNumber,
              timestamp,
              tokenSymbol: symbol,
              eventType: 'BURN',
              rawAmount: parsed.args[0].toString(),
              from: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
              to: ZERO_ADDRESS,
              network: 'Ethereum'
            });
          } else if (parsed.name === 'Mint') {
            await processMintBurnEvent({
              txHash: log.transactionHash,
              logIndex: log.index ?? 0,
              blockNumber: log.blockNumber,
              timestamp,
              tokenSymbol: symbol,
              eventType: 'MINT',
              rawAmount: (parsed.args.amount || parsed.args[2]).toString(),
              from: (parsed.args.minter || parsed.args[0] || ZERO_ADDRESS).toLowerCase(),
              to: (parsed.args.to || parsed.args[1] || '').toLowerCase(),
              network: 'Ethereum'
            });
          } else if (parsed.name === 'Burn') {
            await processMintBurnEvent({
              txHash: log.transactionHash,
              logIndex: log.index ?? 0,
              blockNumber: log.blockNumber,
              timestamp,
              tokenSymbol: symbol,
              eventType: 'BURN',
              rawAmount: (parsed.args.amount || parsed.args[1]).toString(),
              from: (parsed.args.burner || parsed.args[0] || '').toLowerCase(),
              to: ZERO_ADDRESS,
              network: 'Ethereum'
            });
          } else if (parsed.name === 'Transfer') {
            const from = (parsed.args.from || parsed.args[0] || '').toLowerCase();
            const to = (parsed.args.to || parsed.args[1] || '').toLowerCase();
            const value = (parsed.args.value || parsed.args[2]).toString();

            if (from === ZERO_ADDRESS) {
              await processMintBurnEvent({
                txHash: log.transactionHash,
                logIndex: log.index ?? 0,
                blockNumber: log.blockNumber,
                timestamp,
                tokenSymbol: symbol,
                eventType: 'MINT',
                rawAmount: value,
                from: ZERO_ADDRESS,
                to,
                network: 'Ethereum'
              });
            } else if (to === ZERO_ADDRESS) {
              await processMintBurnEvent({
                txHash: log.transactionHash,
                logIndex: log.index ?? 0,
                blockNumber: log.blockNumber,
                timestamp,
                tokenSymbol: symbol,
                eventType: 'BURN',
                rawAmount: value,
                from,
                to: ZERO_ADDRESS,
                network: 'Ethereum'
              });
            }
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

      setupUsdtListeners(usdtContract, wsProvider);
      setupUsdcListeners(usdcContract, wsProvider);

      wsProvider.websocket.on('close', (code) => {
        logger.warn(` Alchemy WebSocket closed (code ${code}). Reconnecting in 5s...`);
        setTimeout(initBlockchainListener, 5000);
      });

      wsProvider.websocket.on('error', (err) => {
        logger.error(' Alchemy WebSocket error:', err.message);
      });

      logger.info('⚡ Alchemy WebSocket stream active and subscribed!');
    } catch (wsErr) {
      logger.warn(' WebSocket initialization warning (Fallback poller will handle events):', wsErr.message);
    }
  }

  // 3. Start Fallback Poller to guarantee zero missed blocks
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
