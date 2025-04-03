const { Schema, model } = require('mongoose');

const withdrawalSchema = new Schema({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  method: {
    type: String,
    enum: ['bank', 'mobile_money'],
    required: true
  },
  transactionId: String,
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationNote: String,
  virtualGiftsDeducted: Number,
  referralBalanceDeducted: Number,
  verifiedAt: Date
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
withdrawalSchema.index({ user: 1, status: 1 });
withdrawalSchema.index({ status: 1, createdAt: 1 });

module.exports = model('Withdrawal', withdrawalSchema);