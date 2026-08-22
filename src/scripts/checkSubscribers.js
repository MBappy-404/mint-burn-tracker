import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Subscriber } from '../models/Subscriber.js';
import { Event } from '../models/Event.js';
import { Bot } from 'grammy';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to DB');

  const subscribers = await Subscriber.find();
  console.log(`📋 Total Subscribers in DB: ${subscribers.length}`);
  subscribers.forEach((s, idx) => {
    console.log(`  ${idx + 1}. ChatID: ${s.chatId}, Type: ${s.chatType}, Active: ${s.isActive}, Threshold: $${s.minThresholdUsd}, Tokens: ${s.tokens}`);
  });

  const eventCount = await Event.countDocuments();
  console.log(`📦 Total Events recorded: ${eventCount}`);

  // Test bot
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
  const me = await bot.api.getMe();
  console.log(`🤖 Bot @${me.username} is authenticated!`);

  if (subscribers.length > 0) {
    const firstSub = subscribers[0];
    console.log(`Testing message send to subscriber ${firstSub.chatId}...`);
    try {
      await bot.api.sendMessage(firstSub.chatId, '🔔 *Test Live Ping from Mint Father Server!*', { parse_mode: 'Markdown' });
      console.log('✅ Message delivered successfully!');
    } catch (e) {
      console.log('❌ Failed to send:', e.message);
    }
  } else {
    console.log('⚠️ NO SUBSCRIBERS FOUND! The user has not sent /start to @usdt_usdc_tracker_bot yet.');
  }

  await mongoose.disconnect();
}

check().catch(console.error);
