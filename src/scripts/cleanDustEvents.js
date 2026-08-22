import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Event } from '../models/Event.js';

async function purgeDust() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);

  const beforeCount = await Event.countDocuments();
  console.log(`Total events before cleanup: ${beforeCount}`);

  // Delete all dust events < $10,000 USD or zero amounts
  const result = await Event.deleteMany({
    $or: [
      { amountFormatted: { $lt: 10000 } },
      { amountFormatted: { $exists: false } },
      { amountFormatted: null },
      { amountFormatted: 0 }
    ]
  });

  const afterCount = await Event.countDocuments();
  console.log(`🗑️ Removed ${result.deletedCount} dust/test events.`);
  console.log(`✅ Clean genuine events remaining: ${afterCount}`);

  const remaining = await Event.find().sort({ timestamp: -1 }).limit(5).lean();
  console.log('Sample Real Events in DB:', remaining);

  await mongoose.disconnect();
}

purgeDust().catch(console.error);
