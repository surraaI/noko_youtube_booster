// models/Referral.js
const { Schema, model } = require('mongoose');

const referralSchema = new Schema({
  referrer: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Referrer is required'] 
  },
  referee: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Referee is required'],
    unique: true 
  },
  order: { 
    type: Schema.Types.ObjectId, 
    ref: 'Order',
    index: true 
  },
  amount: { 
    type: Number, 
    default: 0,  
    min: [0, 'Amount cannot be negative'] 
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'eligible', 'paid', 'reversed'],
      message: 'Invalid referral status'
    },
    default: 'pending'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for common query patterns
referralSchema.index({ referrer: 1, status: 1 });

module.exports = model('Referral', referralSchema);