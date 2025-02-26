// controllers/referralController.js
const User = require('../models/User');
const Referral = require('../models/Referral');
const Payout = require('../models/Payout');
const config = require('../config/referralConfig');
const jwt = require('jsonwebtoken');

// Apply referral code
exports.applyReferralCode = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { referralCode } = req.body;

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.referredBy) return res.status(400).json({ error: 'Referral code already applied' });

    const referrer = await User.findOne({ referralCode });
    if (!referrer) return res.status(400).json({ error: 'Invalid referral code' });
    if (referrer._id.equals(user._id)) return res.status(400).json({ error: 'Cannot refer yourself' });

    // Check for existing referral
    const existingReferral = await Referral.findOne({
      referrer: referrer._id,
      referee: user._id
    });

    if (existingReferral) {
      return res.status(400).json({ error: 'Referral relationship already exists' });
    }

    // Update user and create referral
    user.referredBy = referrer._id;
    await user.save();

    await Referral.create({
      referrer: referrer._id,
      referee: user._id,
      status: 'pending',
      amount: 0
    });

    res.json({ message: 'Referral code applied successfully' });
  } catch (error) {
    console.error('Referral application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getReferralStats = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .select('referralBalance totalEarnings withdrawnAmount referralCode');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const referrals = await Referral.find({ referrer: user._id })
      .populate('referee', 'name email')
      .sort('-createdAt')
      .limit(10);

    res.json({
      balance: user.referralBalance,
      totalEarnings: user.totalEarnings,
      withdrawn: user.withdrawnAmount,
      referralCode: user.referralCode,
      recentReferrals: referrals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.requestPayout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or invalid' });
    }

    // 2. Extract and verify token
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    
    if (user.referralBalance < config.payoutThreshold) {
      return res.status(400).json({
        error: `Minimum payout amount is ${config.payoutThreshold}`
      });
    }

    const payout = await Payout.create({
      user: user._id,
      amount: user.referralBalance,
      method: req.body.method
    });

    user.referralBalance = 0;
    user.withdrawnAmount += payout.amount;
    await user.save();

    res.json(payout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

