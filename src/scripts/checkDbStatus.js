import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Subscriber } from '../models/Subscriber.js';

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const totalEvents = await Event.countDocuments();
  const totalSubs = await Subscriber.countDocuments();
  
  const tokenBreakdown = await Event.aggregate([
    { $group: { _id: '$token', count: { $sum: 1 }, totalUsd: { $sum: '$amountFormatted' } } }
  ]);

  const typeBreakdown = await Event.aggregate([
    { $group: { _id: '$eventType', count: { $sum: 1 }, totalUsd: { $sum: '$amountFormatted' } } }
  ]);

  const subscribers = await Subscriber.find().lean();
  const latestEvents = await Event.find().sort({ timestamp: -1 }).limit(3).lean();

  console.log('=== DB STATS ===');
  console.log(`Total Events Saved: ${totalEvents}`);
  console.log(`Total Subscribers: ${totalSubs}`);
  console.log('Token Breakdown:', tokenBreakdown);
  console.log('Type Breakdown:', typeBreakdown);
  console.log('Subscribers:', subscribers);
  console.log('Latest 3 Events:', latestEvents);

  await mongoose.disconnect();
}

checkDb().catch(console.error);
