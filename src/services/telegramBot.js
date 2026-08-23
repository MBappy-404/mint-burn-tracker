import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { Subscriber } from '../models/Subscriber.js';
import { Event } from '../models/Event.js';
import { logger } from '../config/logger.js';
import { TOKENS, EXPLORER_BASE, getEntityLabel, getExchangeName } from '../config/constants.js';

let bot = null;
let botInfo = null;

// Helper to format currency numbers compactly (e.g., $100M, $250M, $1.2B)
export function formatCompactUSD(num, includeDollar = true) {
  if (num === undefined || num === null || isNaN(num)) {
    return includeDollar ? '$0' : '0';
  }
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const prefix = includeDollar ? '$' : '';

  let formatted = '';
  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    formatted = (val % 1 === 0 ? val.toFixed(0) : val.toFixed(val >= 100 ? 1 : 2).replace(/\.?0+$/, '')) + 'B';
  } else if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    formatted = (val % 1 === 0 ? val.toFixed(0) : val.toFixed(val >= 100 ? 1 : 2).replace(/\.?0+$/, '')) + 'M';
  } else if (abs >= 1_000) {
    const val = abs / 1_000;
    formatted = (val % 1 === 0 ? val.toFixed(0) : val.toFixed(val >= 100 ? 1 : 2).replace(/\.?0+$/, '')) + 'K';
  } else {
    formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  return `${isNegative ? '-' : ''}${prefix}${formatted}`;
}

// Helper to format currency numbers cleanly (e.g., $250,000,000)
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

// Parse user threshold inputs supporting suffixes like 100M, 250M, 1B
export function parseThresholdInput(str) {
  if (!str) return NaN;
  const clean = str.replace(/[\$,]/g, '').trim().toUpperCase();
  if (clean.endsWith('B')) {
    const num = Number(clean.slice(0, -1));
    return isNaN(num) ? NaN : num * 1_000_000_000;
  }
  if (clean.endsWith('M')) {
    const num = Number(clean.slice(0, -1));
    return isNaN(num) ? NaN : num * 1_000_000;
  }
  if (clean.endsWith('K')) {
    const num = Number(clean.slice(0, -1));
    return isNaN(num) ? NaN : num * 1_000;
  }
  return Number(clean);
}

// Generate rich mobile-friendly Markdown alert text
export function formatAlertMessage(event) {
  const tokenMeta = TOKENS[event.token] || { icon: '🪙', symbol: event.token };
  const compactUsd = formatCompactUSD(event.valueUsd || event.amountFormatted);
  const fullUsd = formatCurrency(event.valueUsd || event.amountFormatted);
  const explorerUrl = event.explorerUrl || (event.network === 'Bitcoin' ? `https://mempool.space/tx/${event.txHash}` : `${EXPLORER_BASE}/tx/${event.txHash}`);

  let header = '';
  let actionDetails = '';

  if (event.eventType === 'MINT') {
    header = `🟢 *${event.token} NATIVE MINT* ${tokenMeta.icon} 🚨`;
    actionDetails = `🏛️ *Minter:* \`${event.fromLabel || 'Tether / Circle Treasury'}\`\n📥 *Recipient:* \`${event.toLabel || getEntityLabel(event.to)}\``;
  } else if (event.eventType === 'BURN') {
    header = `🔥 *${event.token} NATIVE BURN* 💥 🚨`;
    actionDetails = `📤 *Burner:* \`${event.fromLabel || getEntityLabel(event.from)}\`\n🔥 *Destination:* \`Null / Treasury Burn\``;
  } else if (event.eventType === 'WALLET_TO_EXCHANGE') {
    header = `📥 *${event.token} INFLOW: WALLET ➔ EXCHANGE* ${tokenMeta.icon} 🚨`;
    actionDetails = `👤 *From (Wallet):* \`${event.fromLabel || getEntityLabel(event.from)}\`\n🏦 *To (Exchange):* \`${event.toLabel || event.exchangeName || 'Exchange'}\``;
  } else if (event.eventType === 'EXCHANGE_TO_WALLET') {
    header = `📤 *${event.token} OUTFLOW: EXCHANGE ➔ WALLET* ${tokenMeta.icon} 🚨`;
    actionDetails = `🏦 *From (Exchange):* \`${event.fromLabel || event.exchangeName || 'Exchange'}\`\n👤 *To (Wallet):* \`${event.toLabel || getEntityLabel(event.to)}\``;
  } else {
    header = `🚨 *${event.token} MAJOR TRANSFER* ${tokenMeta.icon}`;
    actionDetails = `📤 *From:* \`${event.fromLabel || getEntityLabel(event.from)}\`\n📥 *To:* \`${event.toLabel || getEntityLabel(event.to)}\``;
  }

  let amountLine = '';
  if (event.token === 'BTC' || event.token === 'ETH') {
    const cryptoFormatted = Number(event.amountFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 });
    amountLine = `💰 *Value:* \`${compactUsd}\` (${cryptoFormatted} ${event.token} ≈ ${fullUsd})\n`;
  } else {
    amountLine = `💰 *Amount:* \`${compactUsd}\` (${fullUsd} ${event.token})\n`;
  }

  let message = `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `${header}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += amountLine;
  message += `🌐 *Network:* ${event.network || 'Ethereum Mainnet'}\n`;
  message += `📦 *Block:* \`#${event.blockNumber?.toLocaleString() || 'N/A'}\`\n\n`;
  message += `${actionDetails}\n\n`;
  message += `⏰ *Time:* \`${new Date(event.timestamp || Date.now()).toUTCString()}\`\n`;
  message += `🔗 *Tx:* [\`${event.txHash.substring(0, 10)}...${event.txHash.substring(event.txHash.length - 8)}\`](${explorerUrl})`;

  return message;
}

export function createAlertKeyboard(event) {
  const explorerUrl = event.explorerUrl || (event.network === 'Bitcoin' ? `https://mempool.space/tx/${event.txHash}` : `${EXPLORER_BASE}/tx/${event.txHash}`);
  const keyboard = new InlineKeyboard()
    .url('🔎 View On-Chain Explorer', explorerUrl);
  return keyboard;
}

// Persistent bottom Reply Keyboard (Mobile optimized)
export function getPersistentMobileKeyboard() {
  return new Keyboard()
    .text('📊 Bot Status').text('📈 24h Stats').row()
    .text('📜 Recent Events').text('⚙️ Alert Threshold').row()
    .text('🧪 Test USDT Mint').text('🧪 Test BTC Inflow').row()
    .text('🧪 Test ETH Outflow').text('🔔 Toggle Alerts')
    .resized()
    .persistent();
}

// Inline Menu Keyboard
export function getMainInlineKeyboard() {
  return new InlineKeyboard()
    .text('📊 Live Status', 'cmd_status')
    .text('📈 24h Stats', 'cmd_stats')
    .row()
    .text('📜 Recent Events', 'cmd_recent')
    .text('⚙️ Set Threshold', 'cmd_threshold_menu')
    .row()
    .text('🟢 Test USDT Mint (≥$100M)', 'test_usdt_mint')
    .text('🔥 Test USDC Burn (≥$100M)', 'test_usdc_burn')
    .row()
    .text('📥 Test BTC Inflow (≥$100M)', 'test_btc_inflow')
    .text('📤 Test ETH Outflow (≥$100M)', 'test_eth_outflow');
}

// Inline Threshold Quick Selector Keyboard (Flexible Whale & Sentinel Thresholds)
export function getThresholdSelectorKeyboard() {
  return new InlineKeyboard()
    .text('$10M', 'set_th_10000000')
    .text('$25M', 'set_th_25000000')
    .text('$50M', 'set_th_50000000')
    .row()
    .text('🎯 $100M (Standard)', 'set_th_100000000')
    .text('$250M', 'set_th_250000000')
    .row()
    .text('$500M (Whale)', 'set_th_500000000')
    .text('$1B (Institutional)', 'set_th_1000000000')
    .row()
    .text('🔙 Back to Menu', 'cmd_menu');
}

export async function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
  }

  bot = new Bot(token);

  // Error boundary handler
  bot.catch((err) => {
    logger.error('Telegram Bot Error:', err.message);
  });

  // /start command
  bot.command('start', async (ctx) => {
    try {
      const chatId = ctx.chat.id.toString();
      const chatType = ctx.chat.type;
      const username = ctx.chat.username || ctx.from?.username || '';
      const title = ctx.chat.title || ctx.from?.first_name || 'User';

      await Subscriber.findOneAndUpdate(
        { chatId },
        {
          chatId,
          chatType,
          username,
          title,
          minThresholdUsd: 100_000_000,
          tokens: ['BTC', 'ETH', 'USDT', 'USDC'],
          isActive: true
        },
        { upsert: true, new: true }
      );

      const welcomeText = 
`👑 *WELCOME TO MINT FATHER BOT!* 🚀

Real-time Sentinel tracking **$\ge \$100\text{M}$** Institutional Movements:
1. 🏦 **BTC & ETH:** Wallet ➔ Exchange (Inflows) & Exchange ➔ Wallet (Outflows)
2. 💵 **USDT & USDC:** Native Mints & Burns directly from Treasury
3. 🎯 **Strict Filtering:** Only transactions **$\ge \$100,000,000 USD**

🔔 *Status:* Alerts are **ACTIVE**
⚙️ *Current Threshold:* \`$100M+\`

📱 *Mobile Controls:* Tap any quick button below to test or configure:`;

      await ctx.reply(welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: getPersistentMobileKeyboard()
      });

      await ctx.reply('👇 *Select an action from the control panel:*', {
        parse_mode: 'Markdown',
        reply_markup: getMainInlineKeyboard()
      });
    } catch (err) {
      logger.error('Error handling /start:', err.message);
      ctx.reply('❌ An error occurred while setting up. Please try again.');
    }
  });

  // Handle Mobile Reply Keyboard button clicks
  bot.hears('📊 Bot Status', async (ctx) => sendStatusReply(ctx));
  bot.hears('📈 24h Stats', async (ctx) => sendStatsReply(ctx));
  bot.hears('📜 Recent Events', async (ctx) => sendRecentReply(ctx));
  bot.hears('⚙️ Alert Threshold', async (ctx) => sendThresholdMenuReply(ctx));
  bot.hears('🧪 Test USDT Mint', async (ctx) => sendCustomTestAlert(ctx.chat.id.toString(), 'USDT_MINT'));
  bot.hears('🧪 Test BTC Inflow', async (ctx) => sendCustomTestAlert(ctx.chat.id.toString(), 'BTC_INFLOW'));
  bot.hears('🧪 Test ETH Outflow', async (ctx) => sendCustomTestAlert(ctx.chat.id.toString(), 'ETH_OUTFLOW'));
  bot.hears('🔔 Toggle Alerts', async (ctx) => toggleAlertsReply(ctx));

  // Commands
  bot.command('status', async (ctx) => sendStatusReply(ctx));
  bot.command('stats', async (ctx) => sendStatsReply(ctx));
  bot.command('recent', async (ctx) => sendRecentReply(ctx));
  bot.command('menu', async (ctx) => {
    ctx.reply('🎛️ *Mint Father Control Panel:*', {
      parse_mode: 'Markdown',
      reply_markup: getMainInlineKeyboard()
    });
  });

  // /threshold command
  bot.command('threshold', async (ctx) => {
    try {
      const text = ctx.message.text.trim();
      const parts = text.split(/\s+/);
      const chatId = ctx.chat.id.toString();

      if (parts.length < 2) {
        return sendThresholdMenuReply(ctx);
      }

      const newThreshold = parseThresholdInput(parts[1]);

      if (isNaN(newThreshold) || newThreshold < 0) {
        return ctx.reply('❌ Invalid amount. Please enter a valid number (e.g., `/threshold 100M`, `/threshold 250M`, `/threshold 1B`).', { parse_mode: 'Markdown' });
      }

      await Subscriber.findOneAndUpdate(
        { chatId },
        { minThresholdUsd: newThreshold, isActive: true },
        { upsert: true }
      );

      return ctx.reply(`✅ *Threshold Updated!* You will receive alerts for transactions of \`${formatCompactUSD(newThreshold)}\` (${formatCurrency(newThreshold)}) and above.`, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('Error handling /threshold:', err.message);
      ctx.reply('❌ Error updating threshold.');
    }
  });

  // /pause and /resume
  bot.command(['pause', 'mute', 'stop'], async (ctx) => {
    try {
      const chatId = ctx.chat.id.toString();
      await Subscriber.findOneAndUpdate({ chatId }, { isActive: false });
      ctx.reply('🔕 *Alerts Paused!* You will no longer receive notifications. Send `/resume` or tap "🔔 Toggle Alerts" to turn them back on.', { parse_mode: 'Markdown' });
    } catch (e) {
      ctx.reply('❌ Error pausing alerts.');
    }
  });

  bot.command(['resume', 'unmute'], async (ctx) => {
    try {
      const chatId = ctx.chat.id.toString();
      await Subscriber.findOneAndUpdate({ chatId }, { isActive: true });
      ctx.reply('🔔 *Alerts Resumed!* You will receive real-time notifications for ≥$100M movements.', { parse_mode: 'Markdown' });
    } catch (e) {
      ctx.reply('❌ Error resuming alerts.');
    }
  });

  // /test command
  bot.command('test', async (ctx) => {
    await sendCustomTestAlert(ctx.chat.id.toString(), 'USDT_MINT');
  });

  // Callback query dispatcher for inline buttons
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();

    if (data === 'cmd_status') {
      await sendStatusReply(ctx);
    } else if (data === 'cmd_stats') {
      await sendStatsReply(ctx);
    } else if (data === 'cmd_recent') {
      await sendRecentReply(ctx);
    } else if (data === 'cmd_menu') {
      await ctx.reply('🎛️ *Mint Father Control Panel:*', {
        parse_mode: 'Markdown',
        reply_markup: getMainInlineKeyboard()
      });
    } else if (data === 'cmd_threshold_menu') {
      await sendThresholdMenuReply(ctx);
    } else if (data.startsWith('set_th_')) {
      const amount = Number(data.replace('set_th_', ''));
      const chatId = ctx.chat.id.toString();
      await Subscriber.findOneAndUpdate(
        { chatId },
        { minThresholdUsd: amount, isActive: true },
        { upsert: true }
      );
      await ctx.reply(`✅ *Alert Threshold Updated to:* \`${formatCompactUSD(amount)}\` (${formatCurrency(amount)})\nNotifications will trigger for transactions >= this amount.`, {
        parse_mode: 'Markdown'
      });
    } else if (data === 'test_usdt_mint') {
      await sendCustomTestAlert(ctx.chat.id.toString(), 'USDT_MINT');
    } else if (data === 'test_usdc_burn') {
      await sendCustomTestAlert(ctx.chat.id.toString(), 'USDC_BURN');
    } else if (data === 'test_btc_inflow') {
      await sendCustomTestAlert(ctx.chat.id.toString(), 'BTC_INFLOW');
    } else if (data === 'test_eth_outflow') {
      await sendCustomTestAlert(ctx.chat.id.toString(), 'ETH_OUTFLOW');
    }
  });

  // Start the bot polling with error handling
  try {
    botInfo = await bot.api.getMe();
    logger.info(`🤖 Telegram Bot initialized: @${botInfo.username} (${botInfo.first_name})`);

    bot.start({
      onStart: (info) => {
        logger.info(`🚀 Telegram bot polling started for @${info.username}`);
      }
    }).catch((err) => {
      if (err.error_code === 409 || err.message?.includes('409') || err.message?.includes('Conflict')) {
        logger.warn('⚠️ Telegram bot polling notice (409 Conflict - another instance active). Alert broadcaster remains active.');
      } else {
        logger.error('Telegram bot polling error:', err.message);
      }
    });
  } catch (initErr) {
    logger.error('Telegram Bot getMe error:', initErr.message);
  }

  return bot;
}

// Helpers for command replies
async function sendStatusReply(ctx) {
  try {
    const subscriberCount = await Subscriber.countDocuments({ isActive: true });
    const totalEvents = await Event.countDocuments();
    const lastEvent = await Event.findOne().sort({ timestamp: -1 });

    let reply = `📊 *MINT FATHER SENTINEL STATUS*\n\n`;
    reply += `🤖 *Bot:* @${botInfo?.username || 'MintFatherBot'} (Online ✅)\n`;
    reply += `👥 *Active Subscribers:* \`${subscriberCount}\`\n`;
    reply += `📦 *Total Events Recorded (≥$100M):* \`${totalEvents.toLocaleString()}\`\n`;
    reply += `🌐 *Networks Monitored:* Ethereum Mainnet + Bitcoin\n`;
    reply += `🪙 *Tokens Monitored:*\n`;
    reply += `  • 💵 **USDT & USDC:** Native Mints & Burns (≥$100M)\n`;
    reply += `  • 🟧 **BTC & ETH:** Wallet ➔ Exchange & Exchange ➔ Wallet (≥$100M)\n`;
    
    if (lastEvent) {
      reply += `\n🕒 *Last Event:* ${lastEvent.token} ${lastEvent.eventType} (\`${formatCompactUSD(lastEvent.valueUsd || lastEvent.amountFormatted)}\`) - \`${new Date(lastEvent.timestamp).toLocaleTimeString()}\``;
    }

    await ctx.reply(reply, { parse_mode: 'Markdown' });
  } catch (err) {
    ctx.reply('❌ Error fetching status.');
  }
}

async function sendStatsReply(ctx) {
  try {
    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats24h = await Event.aggregate([
      { $match: { timestamp: { $gte: past24h } } },
      {
        $group: {
          _id: { token: '$token', eventType: '$eventType' },
          totalAmount: { $sum: '$valueUsd' },
          count: { $sum: 1 }
        }
      }
    ]);

    let msg = `📈 *24-HOUR INSTITUTIONAL SUMMARY (≥$100M)*\n\n`;
    
    const tokenSummary = { BTC: 0, ETH: 0, USDT: 0, USDC: 0 };
    stats24h.forEach(stat => {
      tokenSummary[stat._id.token] = (tokenSummary[stat._id.token] || 0) + stat.totalAmount;
    });

    msg += `🟧 *BTC Exchange Flow:* \`${formatCompactUSD(tokenSummary.BTC)}\`\n`;
    msg += `🔷 *ETH Exchange Flow:* \`${formatCompactUSD(tokenSummary.ETH)}\`\n`;
    msg += `💵 *USDT Mints/Burns:* \`${formatCompactUSD(tokenSummary.USDT)}\`\n`;
    msg += `🔵 *USDC Mints/Burns:* \`${formatCompactUSD(tokenSummary.USDC)}\`\n\n`;

    const totalVolume = tokenSummary.BTC + tokenSummary.ETH + tokenSummary.USDT + tokenSummary.USDC;
    msg += `🌐 *Total 24h Major Liquidity:* \`${formatCompactUSD(totalVolume)}\``;

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('Error in sendStatsReply:', err.message);
    ctx.reply('❌ Error calculating 24h stats.');
  }
}

async function sendRecentReply(ctx) {
  try {
    const recent = await Event.find().sort({ timestamp: -1 }).limit(5);

    if (recent.length === 0) {
      return ctx.reply('📜 No major events (≥$100M) recorded recently.');
    }

    let msg = `📜 *LATEST 5 MAJOR EVENTS (≥$100M):*\n\n`;
    recent.forEach((ev, idx) => {
      const timeStr = new Date(ev.timestamp).toISOString().replace('T', ' ').substring(0, 19);
      const val = formatCompactUSD(ev.valueUsd || ev.amountFormatted);
      msg += `${idx + 1}. *${ev.token} ${ev.eventType}*: \`${val}\`\n`;
      msg += `   ⏰ \`${timeStr} UTC\` | [Tx](${ev.explorerUrl})\n\n`;
    });

    await ctx.reply(msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) {
    ctx.reply('❌ Error fetching recent events.');
  }
}

async function sendThresholdMenuReply(ctx) {
  try {
    const chatId = ctx.chat.id.toString();
    const sub = await Subscriber.findOne({ chatId });
    const current = sub ? formatCompactUSD(sub.minThresholdUsd) : '$100M';

    const text = 
`⚙️ *ALERT THRESHOLD SETTINGS*

Current Minimum: \`${current}\` (Default: $100M)

Tap a button below or type your custom amount (e.g. \`/threshold 100M\` or \`/threshold 500M\`):`;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: getThresholdSelectorKeyboard()
    });
  } catch (err) {
    ctx.reply('❌ Error opening threshold menu.');
  }
}

async function toggleAlertsReply(ctx) {
  try {
    const chatId = ctx.chat.id.toString();
    const sub = await Subscriber.findOne({ chatId });
    const newState = sub ? !sub.isActive : true;

    await Subscriber.findOneAndUpdate(
      { chatId },
      { isActive: newState },
      { upsert: true }
    );

    if (newState) {
      await ctx.reply('🔔 *Alerts are now ACTIVE!* You will receive notifications for ≥$100M transactions.', { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('🔕 *Alerts PAUSED!* Notifications are muted for this chat. Tap "🔔 Toggle Alerts" anytime to resume.', { parse_mode: 'Markdown' });
    }
  } catch (err) {
    ctx.reply('❌ Error toggling alert state.');
  }
}

export async function sendCustomTestAlert(chatId, testType = 'USDT_MINT') {
  let sampleEvent = null;

  if (testType === 'USDT_MINT') {
    sampleEvent = {
      txHash: '0x32c58611116f1d87e07a34685ff86cb310a08e6840742f534891b97ad8c65f97',
      logIndex: 1,
      blockNumber: 25808630,
      timestamp: new Date(),
      token: 'USDT',
      eventType: 'MINT',
      amount: '1000000000000000',
      amountFormatted: 1000000000,
      valueUsd: 1000000000,
      from: '0x0000000000000000000000000000000000000000',
      to: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
      fromLabel: '🔥 Null / Black Hole',
      toLabel: '🏦 Tether Treasury',
      network: 'Ethereum',
      explorerUrl: 'https://etherscan.io/tx/0x32c58611116f1d87e07a34685ff86cb310a08e6840742f534891b97ad8c65f97'
    };
  } else if (testType === 'USDC_BURN') {
    sampleEvent = {
      txHash: '0x88df6d28e60bf45b60be79116e04d41e7d9b9f939e6a0d4c92e1e0a29352e850',
      logIndex: 1,
      blockNumber: 25808632,
      timestamp: new Date(),
      token: 'USDC',
      eventType: 'BURN',
      amount: '150000000000000',
      amountFormatted: 150000000,
      valueUsd: 150000000,
      from: '0x55fe002a30f5c73e9504b7b72ed222a00461b018',
      to: '0x0000000000000000000000000000000000000000',
      fromLabel: '🏦 Circle: Minter',
      toLabel: '🔥 Null / Black Hole',
      network: 'Ethereum',
      explorerUrl: 'https://etherscan.io/tx/0x88df6d28e60bf45b60be79116e04d41e7d9b9f939e6a0d4c92e1e0a29352e850'
    };
  } else if (testType === 'BTC_INFLOW') {
    sampleEvent = {
      txHash: 'a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d',
      logIndex: 0,
      blockNumber: 885120,
      timestamp: new Date(),
      token: 'BTC',
      eventType: 'WALLET_TO_EXCHANGE',
      amount: '2000',
      amountFormatted: 2000,
      valueUsd: 130000000,
      from: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      to: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo',
      fromLabel: 'Whale Wallet (1A1z...vfNa)',
      toLabel: 'Binance: Cold Storage',
      exchangeName: 'Binance',
      network: 'Bitcoin',
      explorerUrl: 'https://mempool.space/tx/a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d'
    };
  } else if (testType === 'ETH_OUTFLOW') {
    sampleEvent = {
      txHash: '0x4f877c4456950293297a74ea86307137f81498b0a1b2c3d4e5f60718293a4b5c',
      logIndex: 0,
      blockNumber: 25808640,
      timestamp: new Date(),
      token: 'ETH',
      eventType: 'EXCHANGE_TO_WALLET',
      amount: '40000',
      amountFormatted: 40000,
      valueUsd: 112000000,
      from: '0x28c6c06298d514db089934071355e5743bf21d60',
      to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      fromLabel: 'Binance: Hot Wallet 14',
      toLabel: 'Whale Wallet (vitalik.eth)',
      exchangeName: 'Binance',
      network: 'Ethereum',
      explorerUrl: 'https://etherscan.io/tx/0x4f877c4456950293297a74ea86307137f81498b0a1b2c3d4e5f60718293a4b5c'
    };
  }

  const message = formatAlertMessage(sampleEvent);
  const keyboard = createAlertKeyboard(sampleEvent);

  if (chatId && bot) {
    await bot.api.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
  return sampleEvent;
}

export async function sendTestAlert(chatId) {
  return sendCustomTestAlert(chatId, 'USDT_MINT');
}

// Broadcast an event immediately to all active subscribers meeting threshold (>= $100M)
export async function broadcastEvent(event) {
  if (!bot) return;

  try {
    const activeSubscribers = await Subscriber.find({ isActive: true });
    if (!activeSubscribers || !activeSubscribers.length) return;

    const eventValue = event.valueUsd || event.amountFormatted;

    for (const sub of activeSubscribers) {
      const minThreshold = sub.minThresholdUsd !== undefined 
        ? sub.minThresholdUsd 
        : (Number(process.env.DEFAULT_MIN_THRESHOLD_USD) || 100_000_000);

      const isAllowedToken = !sub.tokens || sub.tokens.length === 0 || sub.tokens.includes(event.token);

      if (eventValue >= minThreshold && isAllowedToken) {
        const message = formatAlertMessage(event);
        const keyboard = createAlertKeyboard(event);
        try {
          await bot.api.sendMessage(sub.chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: false
          });
          logger.info(`📢 Alert dispatched to @${sub.username || sub.chatId}: ${event.token} ${event.eventType} (${formatCompactUSD(eventValue)})`);
        } catch (sendErr) {
          handleSendError(sub, sendErr);
        }
      }
    }
  } catch (err) {
    logger.error('Error during broadcastEvent:', err.message);
  }
}

function handleSendError(sub, sendErr) {
  if (sendErr.error_code === 403 || sendErr.description?.includes('blocked') || sendErr.description?.includes('chat not found')) {
    logger.warn(`Subscriber ${sub.chatId} blocked bot. Deactivating...`);
    Subscriber.updateOne({ chatId: sub.chatId }, { isActive: false }).exec();
  } else {
    logger.error(`Failed to send alert to ${sub.chatId}:`, sendErr.message);
  }
}

export function getBotInfo() {
  return botInfo;
}
