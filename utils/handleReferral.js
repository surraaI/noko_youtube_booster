// utils/handleReferral.js
const Referral = require('../models/Referral');
const User = require('../models/User');
const config = require('../config/referralConfig');

exports.processReferralCommission = async (order) => {
  try {
    const user = await User.findById(order.user)
      .populate('referredBy');

    if (!user.referredBy || order.amount < config.minOrderAmount) return;

    const commission = order.amount * config.commissionRate;
    
    // Create referral record
    const referral = await Referral.create({
      referrer: user.referredBy._id,
      referee: user._id,
      order: order._id,
      amount: commission,
      status: 'eligible'
    });

    // Update referrer's balance
    await User.findByIdAndUpdate(user.referredBy._id, {
      $inc: {
        referralBalance: commission,
        totalEarnings: commission
      }
    });

    return referral;
  } catch (error) {
    console.error('Referral processing error:', error);
    throw error;
  }
};