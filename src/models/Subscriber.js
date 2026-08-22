import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema(
  {
    chatId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    chatType: {
      type: String,
      enum: ['private', 'group', 'supergroup', 'channel'],
      default: 'private'
    },
    username: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      default: ''
    },
    minThresholdUsd: {
      type: Number,
      default: Number(process.env.DEFAULT_MIN_THRESHOLD_USD) || 100000
    },
    tokens: {
      type: [String],
      default: ['USDT', 'USDC']
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const Subscriber = mongoose.model('Subscriber', subscriberSchema);
