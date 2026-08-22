import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDatabase, isDbConnected } from './services/db.js';
import { initTelegramBot, getBotInfo, sendTestAlert } from './services/telegramBot.js';
import { initBlockchainListener, getListenerStatus, checkTokenLogs } from './services/blockchainListener.js';
import { Event } from './models/Event.js';
import { Subscriber } from './models/Subscriber.js';
import { registerWebClient, broadcastToWeb } from './services/eventProcessor.js';
import { logger } from './config/logger.js';
import { TOKENS, CONTRACT_ABIS } from './config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 1. Health & Status Endpoint
app.get('/api/status', async (req, res) => {
  try {
    const dbStatus = isDbConnected();
    const botInfo = getBotInfo();
    const listenerStatus = getListenerStatus();
    const subscriberCount = await Subscriber.countDocuments({ isActive: true });
    const totalEvents = await Event.countDocuments();

    res.json({
      success: true,
      status: 'operational',
      database: { connected: dbStatus },
      telegramBot: {
        online: !!botInfo,
        username: botInfo?.username || null,
        activeSubscribers: subscriberCount
      },
      blockchain: {
        network: 'Ethereum Mainnet',
        ...listenerStatus
      },
      totalEventsRecorded: totalEvents,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Events List with Filters
app.get('/api/events', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const token = req.query.token; // 'USDT' or 'USDC'
    const type = req.query.type; // 'MINT' or 'BURN'

    const filter = {};
    if (token) filter.token = token.toUpperCase();
    if (type) filter.eventType = type.toUpperCase();

    const events = await Event.find(filter)
      .sort({ timestamp: -1, _id: -1 })
      .limit(limit);

    res.json({ success: true, count: events.length, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Analytics & Volume Stats Endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [stats24h, statsAllTime] = await Promise.all([
      Event.aggregate([
        { $match: { timestamp: { $gte: past24h } } },
        {
          $group: {
            _id: { token: '$token', eventType: '$eventType' },
            totalAmount: { $sum: '$amountFormatted' },
            count: { $sum: 1 }
          }
        }
      ]),
      Event.aggregate([
        {
          $group: {
            _id: { token: '$token', eventType: '$eventType' },
            totalAmount: { $sum: '$amountFormatted' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const formatGroup = (agg) => {
      const result = {
        USDT: { mint: 0, burn: 0, mintCount: 0, burnCount: 0 },
        USDC: { mint: 0, burn: 0, mintCount: 0, burnCount: 0 }
      };
      agg.forEach((item) => {
        const token = item._id.token;
        const type = item._id.eventType;
        if (result[token]) {
          if (type === 'MINT') {
            result[token].mint = item.totalAmount;
            result[token].mintCount = item.count;
          } else {
            result[token].burn = item.totalAmount;
            result[token].burnCount = item.count;
          }
        }
      });
      return result;
    };

    res.json({
      success: true,
      last24Hours: formatGroup(stats24h),
      allTime: formatGroup(statsAllTime)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Real-time Server-Sent Events (SSE) Stream for Dashboard
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  registerWebClient(res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', time: new Date() })}\n\n`);
});

// 5. Test Alert Trigger
app.post('/api/test-alert', async (req, res) => {
  try {
    const subscriber = await Subscriber.findOne({ isActive: true });
    const testData = await sendTestAlert(subscriber?.chatId);
    
    // Also broadcast to live web UI
    broadcastToWeb(testData);

    res.json({
      success: true,
      message: 'Test alert dispatched successfully!',
      event: testData,
      sentToChatId: subscriber?.chatId || 'None (No active subscriber yet)'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Backfill recent blocks on demand
app.post('/api/backfill', async (req, res) => {
  try {
    const blocks = Math.min(Number(req.body.blocks) || 200, 1000);
    const { httpProvider } = await initBlockchainListener();
    const currentBlock = await httpProvider.getBlockNumber();
    const fromBlock = currentBlock - blocks;

    logger.info(`🔄 Manual backfill requested: scanning last ${blocks} blocks (${fromBlock} -> ${currentBlock})...`);

    await Promise.all([
      checkTokenLogs(TOKENS.USDT.address, CONTRACT_ABIS.USDT, 'USDT', fromBlock, currentBlock),
      checkTokenLogs(TOKENS.USDC.address, CONTRACT_ABIS.USDC, 'USDC', fromBlock, currentBlock)
    ]);

    const count = await Event.countDocuments({ blockNumber: { $gte: fromBlock } });
    res.json({ success: true, fromBlock, toBlock: currentBlock, eventsFound: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Data Cleanup / Deletion Endpoint
app.post('/api/events/delete', async (req, res) => {
  try {
    const { mode, fromDate, toDate, olderThanDays, hours } = req.body;
    let deleteFilter = {};

    if (mode === 'ALL') {
      deleteFilter = {};
    } else if (mode === 'RANGE') {
      if (!fromDate || !toDate) {
        return res.status(400).json({ success: false, error: 'Both Start Date and End Date are required' });
      }
      deleteFilter = {
        timestamp: {
          $gte: new Date(fromDate),
          $lte: new Date(toDate)
        }
      };
    } else if (mode === 'OLDER_THAN_HOURS') {
      const h = Number(hours) || 24;
      const cutoff = new Date(Date.now() - h * 60 * 60 * 1000);
      deleteFilter = { timestamp: { $lt: cutoff } };
    } else if (mode === 'OLDER_THAN_DAYS') {
      const d = Number(olderThanDays) || 7;
      const cutoff = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
      deleteFilter = { timestamp: { $lt: cutoff } };
    } else {
      return res.status(400).json({ success: false, error: 'Invalid delete mode' });
    }

    const result = await Event.deleteMany(deleteFilter);
    const remainingCount = await Event.countDocuments();

    logger.info(`🗑️ Data cleanup executed: Mode '${mode}' removed ${result.deletedCount} events. Remaining: ${remainingCount}`);

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      remainingCount,
      message: `Successfully deleted ${result.deletedCount} transaction events.`
    });
  } catch (err) {
    logger.error('Error during data cleanup:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server & Services
async function bootstrap() {
  try {
    console.log('\n=========================================');
    console.log('   👑 MINT FATHER BOT - STARTING UP   ');
    console.log('=========================================\n');

    // 1. Connect MongoDB
    await connectDatabase();

    // 2. Start Telegram Bot
    await initTelegramBot();

    // 3. Start Blockchain Listener
    await initBlockchainListener();

    // 4. Start Web API Server
    app.listen(PORT, () => {
      logger.info(`🌐 Web Dashboard & API Server live at: http://localhost:${PORT}`);
      logger.info(`🤖 Telegram Bot is ready for commands (@MintFatherBot)`);
    });
  } catch (error) {
    logger.error('💥 Fatal Startup Error:', error.message);
    process.exit(1);
  }
}

// Run bootstrap
bootstrap();
