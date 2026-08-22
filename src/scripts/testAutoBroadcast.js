import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { processMintBurnEvent } from '../services/eventProcessor.js';
import { initTelegramBot } from '../services/telegramBot.js';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('DB connected');

  await initTelegramBot();
  console.log('Bot initialized');

  console.log('Simulating a live new USDT MINT event passing through eventProcessor...');
  const txHash = '0xsimulated_live_' + Date.now();
  
  const result = await processMintBurnEvent({
    txHash,
    logIndex: 0,
    blockNumber: 25808700,
    timestamp: new Date(),
    tokenSymbol: 'USDT',
    eventType: 'MINT',
    rawAmount: '500000000000000', // $500,000,000 USDT
    from: '0x0000000000000000000000000000000000000000',
    to: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
    network: 'Ethereum Mainnet'
  });

  console.log('Processed result:', result ? 'SUCCESS (Dispatched)' : 'FAILED');
  setTimeout(async () => {
    await mongoose.disconnect();
    process.exit(0);
  }, 3000);
}

test().catch(console.error);
