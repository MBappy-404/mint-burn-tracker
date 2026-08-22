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

// In-memory processing lock to prevent race conditions between WebSocket and Poller
const processingLocks = new Set();

/**
 * Process a detected Mint or Burn event:
 * 1. Normalize data and calculate numeric amounts
 * 2. Save uniquely in MongoDB
 * 3. Broadcast to Telegram Subscribers
 * 4. Push live to Web Dashboard
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
  // Remove lock after 30 seconds
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
    
    // Exact floating-point amount representation
    const wholePart = amountBigInt / divisor;
    const remainder = amountBigInt % divisor;
    const amountFormatted = Number(wholePart) + (Number(remainder) / (10 ** decimals));

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
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      fromLabel,
      toLabel,
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
      `${tokenSymbol} ${eventType}: $${amountFormatted.toLocaleString()} | Block #${blockNumber} | Tx: ${txHash.substring(0, 10)}...`
    );

    // Broadcast to Telegram channels & subscribers
    await broadcastEvent(savedEvent);

    // Broadcast to live web dashboard
    broadcastToWeb(savedEvent);

    return savedEvent;
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error - safe to ignore
      return null;
    }
    logger.error('Error processing mint/burn event:', err);
    return null;
  }
}
