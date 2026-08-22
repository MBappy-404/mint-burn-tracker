import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Subscriber } from '../models/Subscriber.js';

async function testDb() {
  console.log('Connecting to MongoDB Atlas...');
  const uri = process.env.MONGODB_URI;
  console.log('URI:', uri.replace(/:([^:@]+)@/, ':****@'));

  await mongoose.connect(uri);
  console.log('✅ MongoDB connected successfully!');

  const eventCount = await Event.countDocuments();
  const subCount = await Subscriber.countDocuments();

  console.log(`📊 Current DB Stats: ${eventCount} events, ${subCount} subscribers.`);
  await mongoose.disconnect();
  console.log('Disconnected cleanly.');
}

testDb().catch((err) => {
  console.error('❌ DB Test Failed:', err);
  process.exit(1);
});
