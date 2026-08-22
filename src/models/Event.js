import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    txHash: {
      type: String,
      required: true,
      index: true
    },
    logIndex: {
      type: Number,
      default: 0
    },
    blockNumber: {
      type: Number,
      required: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    token: {
      type: String,
      required: true,
      enum: ['USDT', 'USDC'],
      index: true
    },
    eventType: {
      type: String,
      required: true,
      enum: ['MINT', 'BURN', 'TREASURY_TRANSFER', 'WHALE_TRANSFER'],
      index: true
    },
    amount: {
      type: String, // String representation of raw BigInt to prevent precision loss
      required: true
    },
    amountFormatted: {
      type: Number, // Decimals-adjusted numeric value (e.g. 250000000) for range queries and aggregations
      required: true,
      index: true
    },
    from: {
      type: String,
      required: true
    },
    to: {
      type: String,
      required: true
    },
    fromLabel: {
      type: String,
      default: ''
    },
    toLabel: {
      type: String,
      default: ''
    },
    network: {
      type: String,
      default: 'Ethereum'
    },
    explorerUrl: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index to prevent duplicate storage of the exact same event
eventSchema.index({ txHash: 1, logIndex: 1 }, { unique: true });

export const Event = mongoose.model('Event', eventSchema);
