const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Withdrawal = require('../models/Withdrawal');
const AuditLog = require('../models/AuditLog');
const { transporter } = require('../config/email');
const { validateEmail } = require('../utils/validators');

// ✅ Create Admin
exports.createAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User with this email already exists.' });
    }

    const temporaryPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const newAdmin = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
      forcePasswordChange: true,
      temporaryPassword: temporaryPassword
    });

    await newAdmin.save({ session });

    try {
      await transporter.sendMail({
        to: newAdmin.email,
        subject: 'Your Admin Account Credentials - Noko',
        html: `
          <h2>Welcome to Noko Admin Panel</h2>
          <p><strong>Email:</strong> ${newAdmin.email}</p>
          <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
          <p style="color:red;">⚠️ You must change your password immediately after login.</p>
          <p>Login at: <a href="${process.env.CLIENT_URL}/admin-login">${process.env.CLIENT_URL}/admin-login</a></p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError.message);
      await AuditLog.create([{
        user: req.user._id,
        action: 'EMAIL_FAILURE',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        metadata: { error: emailError.message, targetEmail: email }
      }], { session });
    }

    await AuditLog.create([{
      user: req.user._id,
      action: 'ADMIN_CREATED',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      metadata: {
        adminId: newAdmin._id,
        adminEmail: newAdmin.email
      }
    }], { session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Admin created successfully.',
      data: {
        id: newAdmin._id,
        email: newAdmin.email
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Create Admin Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    session.endSession();
  }
};

// ✅ Get Admins
exports.getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('-password -temporaryPassword -__v')
      .lean();

    res.json({ success: true, count: admins.length, data: admins });
  } catch (error) {
    console.error('Get Admins Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch admins.' });
  }
};

// ✅ Deactivate Admin
exports.deactivateAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const admin = await User.findOneAndUpdate(
      { _id: id, role: 'admin' },
      { role: 'user' },
      { new: true, session }
    );

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    await AuditLog.create([{
      user: req.user._id,
      action: 'ADMIN_DEACTIVATED',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      metadata: { adminId: admin._id }
    }], { session });

    await session.commitTransaction();

    res.json({ success: true, message: 'Admin deactivated.', data: admin });

  } catch (error) {
    await session.abortTransaction();
    console.error('Deactivate Admin Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to deactivate admin.' });
  } finally {
    session.endSession();
  }
};

// ✅ Get Platform Metrics
exports.getPlatformMetrics = async (req, res) => {
  try {
    const [totalUsers, referredUsers, totalOrders, totalWithdrawals] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ referredBy: { $ne: null } }),
      Order.countDocuments({}),
      Withdrawal.countDocuments({})
    ]);

    res.json({
      success: true,
      data: { totalUsers, referredUsers, totalOrders, totalWithdrawals }
    });
  } catch (error) {
    console.error('Metrics Fetch Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch platform metrics' });
  }
};

// ✅ Get All Withdrawals
exports.getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: withdrawals.length,
      data: withdrawals.map(w => ({
        id: w._id,
        userName: w.user?.name || 'Unknown',
        userEmail: w.user?.email || 'Unknown',
        amount: w.amount,
        status: w.status,
        method: w.method,
        createdAt: w.createdAt,
        verifiedAt: w.verifiedAt
      }))
    });
  } catch (error) {
    console.error('Withdrawals Fetch Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawal logs' });
  }
};

// ✅ Get Platform Notifications
exports.getPlatformNotifications = async (req, res) => {
  try {
    const logs = await AuditLog.find({
      action: { $in: ['WITHDRAWAL_CREATE', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED', 'ORDER_CREATED', 'ADMIN_CREATED'] }
    })
    .sort({ timestamp: -1 })
    .limit(50)
    .lean();

    res.json({
      success: true,
      count: logs.length,
      data: logs.map(log => ({
        action: log.action,
        user: log.user,
        metadata: log.metadata,
        timestamp: log.timestamp
      }))
    });
  } catch (error) {
    console.error('Notification Fetch Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};
