import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Event } from '../models/Event.js';

async function testUpsert() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  const txHash = '0xtest_' + Date.now();
  const eventDoc = {
    txHash,
    logIndex: 0,
    blockNumber: 123456,
    timestamp: new Date(),
    token: 'USDT',
    eventType: 'MINT',
    amount: '1000000',
    amountFormatted: 1,
    from: '0x0000000000000000000000000000000000000000',
    to: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
    network: 'Ethereum'
  };

  const res1 = await Event.findOneAndUpdate(
    { txHash, logIndex: 0 },
    { $setOnInsert: eventDoc },
    { upsert: true, new: true, rawResult: true }
  );

  console.log('Result 1 (new insert):', res1);
  console.log('res1.value:', res1?.value);
  console.log('res1.lastErrorObject:', res1?.lastErrorObject);

  // Clean up test
  await Event.deleteOne({ txHash });
  await mongoose.disconnect();
}

testUpsert().catch(console.error);
