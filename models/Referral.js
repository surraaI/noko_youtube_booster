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
  rewardAmount: { 
    type: Number, 
    default: 0,  
    min: [0, 'Amount cannot be negative'] 
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for quick lookups
referralSchema.index({ referrer: 1 });

module.exports = model('Referral', referralSchema);