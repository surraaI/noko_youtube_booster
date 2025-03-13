// controllers/userController.js
const User = require('../models/User');
const asyncHandler = require('express-async-handler');

exports.getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password -passwordResetToken -passwordResetExpires')
    .lean();

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Alias virtualGifts as coins
  user.coins = user.virtualGifts + user.referralBalance;
  
  res.status(200).json(user);
});

exports.updateUserProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { name, phone } },
    { new: true, runValidators: true }
  ).select('-password -passwordResetToken -passwordResetExpires');

  res.status(200).json(updatedUser);
});

exports.getCoinStats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('virtualGifts referralBalance totalEarnings withdrawnAmount')
    .lean();

  res.status(200).json({
    coins: user.virtualGifts,
    referralBalance: user.referralBalance,
    totalEarnings: user.totalEarnings,
    withdrawnAmount: user.withdrawnAmount
  });
});