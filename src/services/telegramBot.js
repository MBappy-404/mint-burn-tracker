import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { Subscriber } from '../models/Subscriber.js';
import { Event } from '../models/Event.js';
import { logger } from '../config/logger.js';
import { TOKENS, EXPLORER_BASE, getEntityLabel } from '../config/constants.js';

let bot = null;
let botInfo = null;

// Helper to format currency numbers compactly (e.g., $100K, $25.5M, $1B)
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

// Parse user threshold inputs supporting suffixes like 100k, 5M, 1B
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
  let header = '';
  let actionDetails = '';
  const tokenMeta = TOKENS[event.token] || { icon: '🪙', symbol: event.token };
  const compactAmount = formatCompactUSD(event.amountFormatted);
  const fullAmount = formatCurrency(event.amountFormatted);

  if (event.eventType === 'MINT') {
    header = `🟢 *${event.token} MINT / ISSUED* ${tokenMeta.icon}`;
    actionDetails = `🏛️ *Minter:* \`${event.fromLabel || getEntityLabel(event.from)}\`\n📥 *Recipient:* [${event.toLabel || getEntityLabel(event.to)}](${EXPLORER_BASE}/address/${event.to})`;
  } else if (event.eventType === 'BURN') {
    header = `🔥 *${event.token} BURN / REDEEMED* 💥`;
    actionDetails = `📤 *Sender:* [${event.fromLabel || getEntityLabel(event.from)}](${EXPLORER_BASE}/address/${event.from})\n🔥 *Burner:* \`${event.toLabel || getEntityLabel(event.to)}\``;
  } else if (event.eventType === 'TREASURY_TRANSFER') {
    header = `🏛️ *${event.token} TREASURY MOVEMENT* 🚨`;
    actionDetails = `📤 *From:* [${event.fromLabel || getEntityLabel(event.from)}](${EXPLORER_BASE}/address/${event.from})\n📥 *To:* [${event.toLabel || getEntityLabel(event.to)}](${EXPLORER_BASE}/address/${event.to})`;
  } else {
    header = `🐋 *${event.token} WHALE TRANSFER* 🌊`;
    actionDetails = `📤 *From:* [${event.fromLabel || getEntityLabel(event.from)}](${EXPLORER_BASE}/address/${event.from})\n📥 *To:* [${event.toLabel || getEntityLabel(event.to)}](${EXPLORER_BASE}/address/${event.to})`;
  }

  let message = `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `${header}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `💰 *Amount:* \`${compactAmount}\` (${fullAmount} ${event.token})\n`;
  message += `🌐 *Network:* ${event.network || 'Ethereum Mainnet'}\n`;
  message += `📦 *Block:* \`#${event.blockNumber?.toLocaleString() || 'N/A'}\`\n\n`;
  message += `${actionDetails}\n\n`;
  message += `⏰ *Time:* \`${new Date(event.timestamp || Date.now()).toUTCString()}\`\n`;
  message += `🔗 *Tx:* [\`${event.txHash.substring(0, 10)}...${event.txHash.substring(event.txHash.length - 8)}\`](${EXPLORER_BASE}/tx/${event.txHash})`;

  return message;
}

export function createAlertKeyboard(event) {
  const keyboard = new InlineKeyboard()
    .url('🔎 View on Etherscan', `${EXPLORER_BASE}/tx/${event.txHash}`)
    .row()
    .url('🪙 Token Contract', TOKENS[event.token]?.explorer || `${EXPLORER_BASE}/token/${event.token}`);
  return keyboard;
}

// Persistent bottom Reply Keyboard (Mobile optimized!)
export function getPersistentMobileKeyboard() {
  return new Keyboard()
    .text('📊 Bot Status').text('📈 24h Stats').row()
    .text('📜 Recent Events').text('⚙️ Alert Threshold').row()
    .text('🧪 Test USDT Alert').text('🧪 Test USDC Alert').row()
    .text('🏛️ Test Treasury Move').text('🔔 Toggle Alerts')
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
    .text('🟢 Test USDT Mint', 'test_usdt_mint')
    .text('🔥 Test USDT Burn', 'test_usdt_burn')
    .row()
    .text('🏛️ Test Treasury Move', 'test_treasury_move');
}

// Inline Threshold Quick Selector Keyboard
export function getThresholdSelectorKeyboard() {
  return new InlineKeyboard()
    .text('$10K', 'set_th_10000')
    .text('$50K', 'set_th_50000')
    .text('$100K', 'set_th_100000')
    .row()
    .text('$500K', 'set_th_500000')
    .text('$1M', 'set_th_1000000')
    .text('$5M', 'set_th_5000000')
    .row()
    .text('⚡ All Events ($0)', 'set_th_0')
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
          isActive: true
        },
        { upsert: true, new: true }
      );

      const welcomeText = 
`👑 *WELCOME TO MINT FATHER BOT!* 🚀

Real-time on-chain sentinel tracking **USDT (Tether)** and **USDC (Circle)**:
• 🟢 **Mints / Issuances**
• 🔥 **Burns / Redemptions**
• 🏛️ **Tether Treasury Movements**

🔔 *Status:* Alerts are **ACTIVE**
⚙️ *Current Threshold:* \`$100K+\`

📱 *Mobile Controls:* You can use the bottom touch buttons anytime, or use the interactive menu below:`;

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
  bot.hears('🧪 Test USDT Alert', async (ctx) => sendCustomTestAlert(ctx.chat.id.toString(), 'USDT_MINT'));
  bot.hears('🧪 Test USDC Alert', async (ctx) => sendCustomTestAlert(ctx.chat.id.toString(), 'USDC_MINT'));
  bot.hears('🏛️ Test Treasury Move', async (ctx) => sendCustomTestAlert(ctx.chat.id.toString(), 'TREASURY_MOVE'));
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
        return ctx.reply('❌ Invalid amount. Please enter a valid number (e.g., `/threshold 100k`, `/threshold 1M`, `/threshold 250000`).', { parse_mode: 'Markdown' });
      }

      await Subscriber.findOneAndUpdate(
        { chatId },
        { minThresholdUsd: newThreshold, isActive: true },
        { upsert: true }
      );

      return ctx.reply(`✅ *Threshold Updated!* You will now receive alerts for transactions of \`${formatCompactUSD(newThreshold)}\` (${formatCurrency(newThreshold)}) and above.`, { parse_mode: 'Markdown' });
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
      ctx.reply('🔔 *Alerts Resumed!* You will now receive instant mint, burn, and treasury alerts.', { parse_mode: 'Markdown' });
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
      await ctx.reply(`✅ *Alert Threshold Updated to:* \`${formatCompactUSD(amount)}\` (${formatCurrency(amount)})\nTransactions above this amount will trigger instant notifications.`, {
        parse_mode: 'Markdown'
      });
    } else if (data === 'test_usdt_mint') {
      await sendCustomTestAlert(ctx.chat.id.toString(), 'USDT_MINT');
    } else if (data === 'test_usdt_burn') {
      await sendCustomTestAlert(ctx.chat.id.toString(), 'USDT_BURN');
    } else if (data === 'test_treasury_move') {
      await sendCustomTestAlert(ctx.chat.id.toString(), 'TREASURY_MOVE');
    }
  });

  // Start the bot polling
  botInfo = await bot.api.getMe();
  logger.info(`🤖 Telegram Bot initialized: @${botInfo.username} (${botInfo.first_name})`);

  bot.start({
    onStart: (botInfo) => {
      logger.info(`🚀 Telegram bot polling started for @${botInfo.username}`);
    }
  });

  return bot;
}

// Helpers for command replies
async function sendStatusReply(ctx) {
  try {
    const subscriberCount = await Subscriber.countDocuments({ isActive: true });
    const totalEvents = await Event.countDocuments();
    const lastEvent = await Event.findOne().sort({ timestamp: -1 });

    let reply = `📊 *MINT FATHER BOT STATUS*\n\n`;
    reply += `🤖 *Bot:* @${botInfo?.username || 'MintFatherBot'} (Online ✅)\n`;
    reply += `👥 *Active Subscribers:* \`${subscriberCount}\`\n`;
    reply += `📦 *Total Events Recorded:* \`${totalEvents.toLocaleString()}\`\n`;
    reply += `🌐 *Network Monitored:* Ethereum Mainnet\n`;
    reply += `🪙 *Tokens Monitored:* USDT (Tether), USDC (Circle)\n`;
    
    if (lastEvent) {
      reply += `\n🕒 *Last Event:* ${lastEvent.token} ${lastEvent.eventType} (\`${formatCompactUSD(lastEvent.amountFormatted)}\`) - \`${new Date(lastEvent.timestamp).toLocaleTimeString()}\``;
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
          totalAmount: { $sum: '$amountFormatted' },
          count: { $sum: 1 }
        }
      }
    ]);

    let usdtMint24 = 0, usdtBurn24 = 0;
    let usdcMint24 = 0, usdcBurn24 = 0;
    let usdtMintCount = 0, usdtBurnCount = 0;
    let usdcMintCount = 0, usdcBurnCount = 0;

    stats24h.forEach(stat => {
      if (stat._id.token === 'USDT') {
        if (stat._id.eventType === 'MINT') {
          usdtMint24 = stat.totalAmount;
          usdtMintCount = stat.count;
        } else {
          usdtBurn24 = stat.totalAmount;
          usdtBurnCount = stat.count;
        }
      } else if (stat._id.token === 'USDC') {
        if (stat._id.eventType === 'MINT') {
          usdcMint24 = stat.totalAmount;
          usdcMintCount = stat.count;
        } else {
          usdcBurn24 = stat.totalAmount;
          usdcBurnCount = stat.count;
        }
      }
    });

    let msg = `📈 *24-HOUR MINT & BURN SUMMARY*\n\n`;
    msg += `💵 *USDT (Tether):*\n`;
    msg += `  🟢 Minted: \`${formatCompactUSD(usdtMint24)}\` (${usdtMintCount} txs)\n`;
    msg += `  🔥 Burned: \`${formatCompactUSD(usdtBurn24)}\` (${usdtBurnCount} txs)\n`;
    msg += `  📊 Net Change: \`${formatCompactUSD(usdtMint24 - usdtBurn24)}\`\n\n`;

    msg += `🔵 *USDC (Circle):*\n`;
    msg += `  🟢 Minted: \`${formatCompactUSD(usdcMint24)}\` (${usdcMintCount} txs)\n`;
    msg += `  🔥 Burned: \`${formatCompactUSD(usdcBurn24)}\` (${usdcBurnCount} txs)\n`;
    msg += `  📊 Net Change: \`${formatCompactUSD(usdcMint24 - usdcBurn24)}\`\n\n`;

    const totalMinted = usdtMint24 + usdcMint24;
    const totalBurned = usdtBurn24 + usdcBurn24;
    msg += `🌐 *Total 24h Stablecoin Flow:*\n`;
    msg += `➕ Minted: \`${formatCompactUSD(totalMinted)}\`\n`;
    msg += `➖ Burned: \`${formatCompactUSD(totalBurned)}\`\n`;
    msg += `🎯 Net Liquidity: \`${formatCompactUSD(totalMinted - totalBurned)}\``;

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
      return ctx.reply('📜 No mint or burn events recorded yet. Stay tuned as new blocks are processed!');
    }

    let msg = `📜 *LATEST 5 MINT & BURN EVENTS:*\n\n`;
    recent.forEach((ev, idx) => {
      const icon = ev.eventType === 'MINT' ? '🟢' : '🔥';
      const timeStr = new Date(ev.timestamp).toISOString().replace('T', ' ').substring(0, 19);
      msg += `${idx + 1}. ${icon} *${ev.token} ${ev.eventType}*: \`${formatCompactUSD(ev.amountFormatted)}\` (${formatCurrency(ev.amountFormatted)})\n`;
      msg += `   ⏰ \`${timeStr} UTC\` | [Tx](${EXPLORER_BASE}/tx/${ev.txHash})\n\n`;
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
    const current = sub ? formatCompactUSD(sub.minThresholdUsd) : '$100K';

    const text = 
`⚙️ *ALERT THRESHOLD SETTINGS*

Current Minimum: \`${current}\`

Tap a button below to quickly set your notification threshold, or type your own amount (e.g. \`/threshold 250k\` or \`/threshold 250000\`):`;

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
      await ctx.reply('🔔 *Alerts are now ACTIVE!* You will receive real-time notifications for mints & burns.', { parse_mode: 'Markdown' });
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
      from: '0x0000000000000000000000000000000000000000',
      to: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
      fromLabel: '🔥 Null Address',
      toLabel: '🏦 Tether Treasury',
      network: 'Ethereum Mainnet'
    };
  } else if (testType === 'USDT_BURN') {
    sampleEvent = {
      txHash: '0x88df6d28e60bf45b60be79116e04d41e7d9b9f939e6a0d4c92e1e0a29352e850',
      logIndex: 1,
      blockNumber: 25808632,
      timestamp: new Date(),
      token: 'USDT',
      eventType: 'BURN',
      amount: '500000000000000',
      amountFormatted: 500000000,
      from: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
      to: '0x0000000000000000000000000000000000000000',
      fromLabel: '🏦 Tether Treasury',
      toLabel: '🔥 Null Address (Burn)',
      network: 'Ethereum Mainnet'
    };
  } else if (testType === 'TREASURY_MOVE') {
    sampleEvent = {
      txHash: '0x99fe7a22026afc66a98fbb0a0afe71e0f007b949112233445566778899aabbcc',
      logIndex: 2,
      blockNumber: 25808635,
      timestamp: new Date(),
      token: 'USDT',
      eventType: 'TREASURY_TRANSFER',
      amount: '150000000000000',
      amountFormatted: 150000000,
      from: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
      to: '0x28c6c06298d514db089934071355e5743bf21d60',
      fromLabel: '🏦 Tether Treasury',
      toLabel: '🟡 Binance: Hot Wallet 14',
      network: 'Ethereum Mainnet'
    };
  } else {
    sampleEvent = {
      txHash: '0x55aa6d28e60bf45b60be79116e04d41e7d9b9f939e6a0d4c92e1e0a29352e123',
      logIndex: 1,
      blockNumber: 25808640,
      timestamp: new Date(),
      token: 'USDC',
      eventType: 'MINT',
      amount: '50000000000000',
      amountFormatted: 50000000,
      from: '0x55fe002a30f5c73e9504b7b72ed222a00461b018',
      to: '0x503828976d22510aad0201ac7ec88293211d23da',
      fromLabel: '🏦 Circle: Minter',
      toLabel: '🔵 Coinbase: Hot Wallet',
      network: 'Ethereum Mainnet'
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

// Broadcast queue for 1-minute batch dispatch
let pendingAlertQueue = [];
let dispatcherInterval = null;

/**
 * Queue an event to be dispatched in the 1-minute cycle
 */
export function queueEventForBroadcast(event) {
  pendingAlertQueue.push(event);
}

/**
 * Start the 1-minute batch alert dispatcher
 */
export function startAlertDispatcher() {
  if (dispatcherInterval) return;

  const intervalMs = Number(process.env.ALERT_INTERVAL_MS) || 60000; // Default 1 minute (60,000 ms)
  logger.info(`⏰ 1-Minute Alert Dispatcher initialized (cycles every ${intervalMs / 1000}s). Only big amounts will trigger notifications.`);

  dispatcherInterval = setInterval(async () => {
    try {
      await flushAlertQueue();
    } catch (err) {
      logger.error('Error in alert dispatcher cycle:', err.message);
    }
  }, intervalMs);
}

/**
 * Flush and dispatch matching big events to subscribers
 */
export async function flushAlertQueue() {
  if (!bot || pendingAlertQueue.length === 0) {
    return;
  }

  // Drain pending queue
  const eventsToProcess = pendingAlertQueue.splice(0, pendingAlertQueue.length);
  logger.debug(`Processing 1-minute batch with ${eventsToProcess.length} event(s)...`);

  try {
    const activeSubscribers = await Subscriber.find({ isActive: true });
    if (!activeSubscribers.length) return;

    for (const sub of activeSubscribers) {
      const minThreshold = sub.minThresholdUsd !== undefined ? sub.minThresholdUsd : (Number(process.env.DEFAULT_MIN_THRESHOLD_USD) || 100000);
      
      // Filter big amount events that meet this subscriber's threshold and token preference
      const matchingEvents = eventsToProcess.filter(ev => 
        ev.amountFormatted >= minThreshold && 
        (sub.tokens && sub.tokens.includes(ev.token))
      );

      if (matchingEvents.length === 0) {
        // No big events for this user in this 1-minute window -> Stay quiet!
        continue;
      }

      // Sort matching events by amount descending (biggest first)
      matchingEvents.sort((a, b) => b.amountFormatted - a.amountFormatted);

      logger.info(`📢 Dispatching ${matchingEvents.length} big event(s) to @${sub.username || sub.chatId} (Threshold: $${minThreshold.toLocaleString()})`);

      // If up to 3 events, send individual rich cards
      if (matchingEvents.length <= 3) {
        for (const event of matchingEvents) {
          const message = formatAlertMessage(event);
          const keyboard = createAlertKeyboard(event);
          try {
            await bot.api.sendMessage(sub.chatId, message, {
              parse_mode: 'Markdown',
              reply_markup: keyboard,
              disable_web_page_preview: false
            });
          } catch (sendErr) {
            handleSendError(sub, sendErr);
          }
        }
      } else {
        // If more than 3 big events happened in this minute, send a consolidated bundle to avoid flooding
        const topEvents = matchingEvents.slice(0, 3);
        for (const event of topEvents) {
          const message = formatAlertMessage(event);
          const keyboard = createAlertKeyboard(event);
          try {
            await bot.api.sendMessage(sub.chatId, message, {
              parse_mode: 'Markdown',
              reply_markup: keyboard,
              disable_web_page_preview: false
            });
          } catch (sendErr) {
            handleSendError(sub, sendErr);
          }
        }

        const remainingCount = matchingEvents.length - 3;
        const totalVolume = matchingEvents.reduce((acc, curr) => acc + curr.amountFormatted, 0);
        const summaryMsg = `⚡ *+${remainingCount} more major transactions* in this 1-minute window!\n💰 *Total 1-Min Batch Volume:* \`${formatCurrency(totalVolume)}\`\n👉 Check live dashboard for full breakdown.`;
        
        try {
          await bot.api.sendMessage(sub.chatId, summaryMsg, { parse_mode: 'Markdown' });
        } catch (sendErr) {
          handleSendError(sub, sendErr);
        }
      }
    }
  } catch (err) {
    logger.error('Error during batch broadcast:', err.message);
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

// Broadcast an event immediately to all active subscribers meeting threshold
export async function broadcastEvent(event) {
  if (!bot) return;

  try {
    const activeSubscribers = await Subscriber.find({ isActive: true });
    if (!activeSubscribers || !activeSubscribers.length) return;

    for (const sub of activeSubscribers) {
      const minThreshold = sub.minThresholdUsd !== undefined 
        ? sub.minThresholdUsd 
        : (Number(process.env.DEFAULT_MIN_THRESHOLD_USD) || 100000);

      const isAllowedToken = !sub.tokens || sub.tokens.length === 0 || sub.tokens.includes(event.token);

      if (event.amountFormatted >= minThreshold && isAllowedToken) {
        const message = formatAlertMessage(event);
        const keyboard = createAlertKeyboard(event);
        try {
          await bot.api.sendMessage(sub.chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: false
          });
          logger.info(`📢 Alert dispatched to @${sub.username || sub.chatId}: ${event.token} ${event.eventType} (${formatCompactUSD(event.amountFormatted)})`);
        } catch (sendErr) {
          handleSendError(sub, sendErr);
        }
      }
    }
  } catch (err) {
    logger.error('Error during broadcastEvent:', err.message);
  }
}

export function getBotInfo() {
  return botInfo;
}

