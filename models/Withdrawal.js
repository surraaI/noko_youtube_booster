const { Schema, model } = require('mongoose');
const mongooseFieldEncryption = require('mongoose-field-encryption').fieldEncryption;
const crypto = require('crypto');

const withdrawalSchema = new Schema({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
    set: v => Number(v.toFixed(2)),
    get: v => Number(v.toFixed(2))
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  method: {
    type: String,
    enum: ['bank', 'mobile_money'],
    required: true,
    validate: {
      validator: v => /^(bank|mobile_money)$/.test(v),
      message: 'Invalid withdrawal method'
    }
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationNote: {
    type: String,
    maxlength: 500
  },
  virtualGiftsDeducted: {
    type: Number,
    min: 0,
    set: v => Number(v.toFixed(2)),
    get: v => Number(v.toFixed(2))
  },
  referralBalanceDeducted: {
    type: Number,
    min: 0,
    set: v => Number(v.toFixed(2)),
    get: v => Number(v.toFixed(2))
  },
  verifiedAt: Date,
  bankDetails: {
    accountNumber: {
      type: String,
      required: true,
      validate: {
        validator: v => /^[a-f0-9:]+$/.test(v),
        message: 'Invalid encrypted format'
      }
    },
    accountHolderName: {
      type: String,
      required: true,
      validate: {
        validator: v => v.length >= 5,
        message: 'Account holder name too short'
      }
    },
    bankName: {
      type: String,
      required: true,
      validate: {
        validator: v => v.length >= 3,
        message: 'Bank name too short'
      }
    }
  }
}, { 
  timestamps: true,
  toJSON: { 
    virtuals: true,
    getters: true,
    transform: (doc, ret) => {
      delete ret.bankDetails;
      return ret;
    }
  },
  toObject: { virtuals: true, getters: true }
});

// Field-level encryption
withdrawalSchema.plugin(mongooseFieldEncryption, {
  fields: ['bankDetails'],
  secret: process.env.MONGO_ENC_SECRET,
  saltGenerator: secret => crypto.randomBytes(32)
});

// Indexes
withdrawalSchema.index({ createdAt: -1 });
withdrawalSchema.index({ user: 1, status: 1 });
withdrawalSchema.index({ method: 1, status: 1 });

module.exports = model('Withdrawal', withdrawalSchema);