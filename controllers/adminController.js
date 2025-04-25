// controllers/adminController.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { transporter } = require('../config/email');
const { validateEmail } = require('../utils/validators');

const adminController = {
  createAdmin: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 1. Validate request body
      const { name, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          message: 'Name and email are required fields'
        });
      }

      // 2. Validate email format
      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // 3. Check for existing user
      const existingUser = await User.findOne({ email }).session(session);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // 4. Generate temporary password
      const temporaryPassword = crypto.randomBytes(12).toString('hex');
      const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

      // 5. Create admin user
      const newAdmin = new User({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'admin',
        isVerified: true,
        security: {
          forcePasswordChange: true,
          temporaryPassword: temporaryPassword,
          passwordHistory: []
        }
      });

      // 6. Save admin user
      await newAdmin.save({ session });

      // 7. Send email with credentials
      try {
        await transporter.sendMail({
          to: newAdmin.email,
          subject: 'Admin Account Created - Noko YouTube Booster',
          html: `
            <h2>Admin Account Created</h2>
            <p>Your temporary credentials:</p>
            <p><strong>Email:</strong> ${newAdmin.email}</p>
            <p><strong>Password:</strong> ${temporaryPassword}</p>
            <p style="color: #ff0000;">
              ⚠️ You must change this password immediately after first login
            </p>
            <p>Login URL: ${process.env.CLIENT_URL}/admin-login</p>
          `
        });
      } catch (emailError) {
        await AuditLog.create([{
          action: 'email_failure',
          performedBy: req.user._id,
          targetUser: newAdmin._id,
          metadata: {
            error: emailError.message,
            tempPassword: temporaryPassword
          }
        }], { session });
      }

      // 8. Create audit log
      await AuditLog.create([{
        action: 'admin_created',
        performedBy: req.user._id,
        targetUser: newAdmin._id,
        metadata: {
          adminEmail: newAdmin.email,
          creationMethod: 'manual'
        }
      }], { session });

      // 9. Commit transaction
      await session.commitTransaction();

      res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        data: {
          id: newAdmin._id,
          email: newAdmin.email,
          createdAt: newAdmin.createdAt
        }
      });

    } catch (error) {
      await session.abortTransaction();
      console.error(`Admin Creation Error: ${error.message}`);
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      session.endSession();
    }
  },

  // Additional admin controller methods
  getAdmins: async (req, res) => {
    try {
      const admins = await User.find({ role: 'admin' })
        .select('-password -security -__v')
        .lean();

      res.json({
        success: true,
        count: admins.length,
        data: admins
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve admin list'
      });
    }
  },

  deactivateAdmin: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;

      const admin = await User.findByIdAndUpdate(
        id,
        { isActive: false, deactivatedAt: Date.now() },
        { new: true, session }
      ).select('-password -security -__v');

      if (!admin || admin.role !== 'admin') {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      await AuditLog.create([{
        action: 'admin_deactivated',
        performedBy: req.user._id,
        targetUser: admin._id,
        metadata: {
          deactivatedAt: new Date()
        }
      }], { session });

      await session.commitTransaction();

      res.json({
        success: true,
        message: 'Admin deactivated successfully',
        data: admin
      });

    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({
        success: false,
        message: 'Deactivation failed'
      });
    } finally {
      session.endSession();
    }
  }
};

module.exports = adminController;