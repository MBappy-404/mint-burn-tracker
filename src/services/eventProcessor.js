import { Event } from '../models/Event.js';
import { TOKENS, ZERO_ADDRESS, getEntityLabel } from '../config/constants.js';
import { logger } from '../config/logger.js';
import { broadcastEvent } from './telegramBot.js';

// Connected web clients for real-time SSE updates
const webClients = new Set();

export function registerWebClient(res) {
  webClients.add(res);
  res.on('close', () => {
    webClients.delete(res);
  });
}

export function broadcastToWeb(event) {
  const data = JSON.stringify(event);
  for (const client of webClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      webClients.delete(client);
    }
  }
}

// In-memory processing lock to prevent duplicate processing
const processingLocks = new Set();

/**
 * Process a detected USDT or USDC Native Mint or Burn event:
 * 1. Calculate amount & USD value
 * 2. Filter strictly >= $100 Million USD ($100,000,000)
 * 3. Save in MongoDB
 * 4. Broadcast to Telegram & Web
 */
export async function processMintBurnEvent({
  txHash,
  logIndex = 0,
  blockNumber,
  timestamp = new Date(),
  tokenSymbol,
  eventType,
  rawAmount,
  from,
  to,
  network = 'Ethereum'
}) {
  const lockKey = `${txHash}_${logIndex}`;
  if (processingLocks.has(lockKey)) {
    return null;
  }
  processingLocks.add(lockKey);
  setTimeout(() => processingLocks.delete(lockKey), 30000);

  try {
    const tokenInfo = TOKENS[tokenSymbol];
    if (!tokenInfo) {
      logger.warn(`Unknown token symbol: ${tokenSymbol}`);
      return null;
    }

    const decimals = tokenInfo.decimals || 6;
    const amountBigInt = BigInt(rawAmount.toString());
    const divisor = 10n ** BigInt(decimals);
    
    const wholePart = amountBigInt / divisor;
    const remainder = amountBigInt % divisor;
    const amountFormatted = Number(wholePart) + (Number(remainder) / (10 ** decimals));
    const valueUsd = amountFormatted; // 1 USDT = $1, 1 USDC = $1

    // STRICT USER REQUIREMENT: Only transactions >= $100,000,000 USD
    const minThreshold = Number(process.env.DEFAULT_MIN_THRESHOLD_USD) || 100_000_000;
    if (valueUsd < minThreshold || isNaN(valueUsd) || valueUsd <= 0) {
      return null;
    }

    const fromLabel = getEntityLabel(from);
    const toLabel = getEntityLabel(to);

    const eventDoc = {
      txHash,
      logIndex,
      blockNumber,
      timestamp,
      token: tokenSymbol,
      eventType,
      amount: rawAmount.toString(),
      amountFormatted,
      valueUsd,
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      fromLabel,
      toLabel,
      exchangeName: '',
      network,
      explorerUrl: `https://etherscan.io/tx/${txHash}`
    };

    // Check if event was already processed in MongoDB
    const existing = await Event.findOne({ txHash, logIndex });
    if (existing) {
      return existing;
    }

    // Save newly detected event
    const savedEvent = await Event.create(eventDoc);

    logger.event(
      eventType,
      `🚨 ${tokenSymbol} ${eventType}: $${amountFormatted.toLocaleString()} | Block #${blockNumber} | Tx: ${txHash.substring(0, 10)}...`
    );

    // Broadcast to Telegram channels & subscribers
    await broadcastEvent(savedEvent);

    // Broadcast to live web dashboard
    broadcastToWeb(savedEvent);

    return savedEvent;
  } catch (err) {
    if (err.code === 11000) {
      return null;
    }
    logger.error('Error processing mint/burn event:', err.message);
    return null;
  }
}

/**
 * Process a detected BTC or ETH Whale Transaction (Wallet <-> Exchange)
 */
export async function processWhaleTransaction({
  txHash,
  logIndex = 0,
  blockNumber,
  timestamp = new Date(),
  tokenSymbol,
  eventType,
  cryptoAmount,
  valueUsd,
  from,
  to,
  fromLabel,
  toLabel,
  exchangeName,
  network = 'Ethereum'
}) {
  const lockKey = `${txHash}_${logIndex}`;
  if (processingLocks.has(lockKey)) {
    return null;
  }
  processingLocks.add(lockKey);
  setTimeout(() => processingLocks.delete(lockKey), 30000);

  try {
    // STRICT USER REQUIREMENT: Only transactions >= $100,000,000 USD
    const minThreshold = Number(process.env.DEFAULT_MIN_THRESHOLD_USD) || 100_000_000;
    if (valueUsd < minThreshold || isNaN(valueUsd) || valueUsd <= 0) {
      return null;
    }

    const explorerUrl = network === 'Bitcoin' 
      ? `https://mempool.space/tx/${txHash}`
      : `https://etherscan.io/tx/${txHash}`;

    const eventDoc = {
      txHash,
      logIndex,
      blockNumber,
      timestamp,
      token: tokenSymbol,
      eventType,
      amount: cryptoAmount.toString(),
      amountFormatted: cryptoAmount,
      valueUsd,
      from: from.toLowerCase ? from.toLowerCase() : from,
      to: to.toLowerCase ? to.toLowerCase() : to,
      fromLabel,
      toLabel,
      exchangeName: exchangeName || '',
      network,
      explorerUrl
    };

    const existing = await Event.findOne({ txHash, logIndex });
    if (existing) {
      return existing;
    }

    const savedEvent = await Event.create(eventDoc);

    logger.event(
      eventType,
      `🚨 ${tokenSymbol} ${eventType}: ${cryptoAmount.toLocaleString()} ${tokenSymbol} ($${Math.round(valueUsd).toLocaleString()}) | ${exchangeName} | Block #${blockNumber}`
    );

    // Broadcast to Telegram subscribers
    await broadcastEvent(savedEvent);

    // Broadcast to Web SSE
    broadcastToWeb(savedEvent);

    return savedEvent;
  } catch (err) {
    if (err.code === 11000) {
      return null;
    }
    logger.error('Error processing whale transaction:', err.message);
    return null;
  }
}
