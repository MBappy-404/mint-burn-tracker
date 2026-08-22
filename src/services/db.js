import mongoose from 'mongoose';
import { logger } from '../config/logger.js';

let isConnected = false;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    logger.info(' Connected to MongoDB Atlas successfully!');
  } catch (error) {
    isConnected = false;
    logger.error(' MongoDB connection failed:', error.message);
    throw error;
  }

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn(' MongoDB disconnected! Attempting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    logger.info(' MongoDB reconnected successfully!');
  });
}

export function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}
