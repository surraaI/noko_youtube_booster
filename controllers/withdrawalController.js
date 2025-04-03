const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Encryption configuration
const algorithm = 'aes-256-cbc';
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const iv = Buffer.from(process.env.ENCRYPTION_IV, 'hex');

const encrypt = (text) => {
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

const decrypt = (encryptedText) => {
  const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

exports.createWithdrawal = async (req, res) => {
  const session = await User.startSession();
  session.startTransaction();

  try {
    // Verify transaction token
    const { transactionToken } = req.body;
    const decoded = jwt.verify(transactionToken, process.env.JWT_SECRET);
    
    if (decoded.purpose !== 'withdrawal' || decoded.userId !== req.user.id) {
      throw new Error('Invalid transaction token');
    }

    const user = await User.findById(req.user.id).session(session);
    const { accountNumber, accountHolderName, bankName, method } = req.body;

    // Validate bank details
    if (!/^\d{9,18}$/.test(accountNumber)) {
      throw new Error('Invalid account number format');
    }

    if (!/^[A-Za-z\s]{5,}$/.test(accountHolderName)) {
      throw new Error('Invalid account holder name');
    }

    // Calculate amounts
    const virtualGiftsDeducted = user.virtualGifts / 2;
    const referralBalanceDeducted = user.referralBalance;
    const feePercentage = process.env.TRANSACTION_FEE_PERCENTAGE || 2.5;
    const fee = (virtualGiftsDeducted + referralBalanceDeducted) * (feePercentage / 100);
    const netAmount = (virtualGiftsDeducted + referralBalanceDeducted) - fee;

    if (netAmount < (process.env.MIN_WITHDRAWAL || 100)) {
      throw new Error(`Minimum net withdrawal amount is ${process.env.MIN_WITHDRAWAL || 100}`);
    }

    // Create withdrawal record
    const withdrawal = await Withdrawal.create([{
      user: user._id,
      amount: netAmount,
      method,
      virtualGiftsDeducted,
      referralBalanceDeducted,
      bankDetails: {
        accountNumber: encrypt(accountNumber),
        accountHolderName: encrypt(accountHolderName),
        bankName: encrypt(bankName)
      }
    }], { session });

    // Update user balances
    user.virtualGifts -= virtualGiftsDeducted;
    user.referralBalance = 0;
    await user.save({ session });

    await session.commitTransaction();
    
    res.status(201).json({
      message: 'Withdrawal request submitted',
      withdrawal: {
        ...withdrawal[0].toObject(),
        bankDetails: {
          accountNumber: `••••${accountNumber.slice(-4)}`,
          accountHolderName,
          bankName
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ 
      error: error.message,
      code: error.code || 'WITHDRAWAL_CREATION_FAILED' 
    });
  } finally {
    session.endSession();
  }
};

exports.getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user.id })
      .sort('-createdAt')
      .lean()
      .transform(results => results.map(w => ({
        ...w,
        bankDetails: {
          accountNumber: `••••${decrypt(w.bankDetails.accountNumber).slice(-4)}`,
          bankName: w.bankDetails.bankName ? decrypt(w.bankDetails.bankName) : null
        }
      })));

    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to retrieve withdrawals',
      code: 'WITHDRAWAL_RETRIEVAL_FAILED'
    });
  }
};

exports.getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ status: 'pending' })
      .populate('user', 'name email')
      .sort('-createdAt');

    res.json(withdrawals.map(w => ({
      ...w.toObject(),
      bankDetails: {
        accountNumber: `••••${decrypt(w.bankDetails.accountNumber).slice(-4)}`
      }
    })));
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to retrieve pending withdrawals',
      code: 'PENDING_WITHDRAWALS_ERROR'
    });
  }
};

exports.processWithdrawal = async (req, res) => {
  const session = await Withdrawal.startSession();
  session.startTransaction();

  try {
    const withdrawal = await Withdrawal.findById(req.params.id)
      .session(session)
      .populate('user');

    if (!withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'pending') {
      throw new Error('Withdrawal already processed');
    }

    withdrawal.status = req.body.status;
    withdrawal.verifiedBy = req.user.id;
    withdrawal.verificationNote = req.body.note;
    withdrawal.verifiedAt = new Date();

    if (req.body.status === 'rejected') {
      await User.findByIdAndUpdate(
        withdrawal.user._id,
        {
          $inc: {
            virtualGifts: withdrawal.virtualGiftsDeducted,
            referralBalance: withdrawal.referralBalanceDeducted
          }
        },
        { session }
      );
    }

    await withdrawal.save({ session });
    await session.commitTransaction();
    
    res.json({
      message: `Withdrawal ${req.body.status} successfully`,
      withdrawal: {
        ...withdrawal.toObject(),
        bankDetails: {
          accountNumber: `••••${decrypt(withdrawal.bankDetails.accountNumber).slice(-4)}`
        }
      }
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ 
      error: error.message,
      code: 'WITHDRAWAL_PROCESSING_ERROR'
    });
  } finally {
    session.endSession();
  }
};

exports.getSecureDetails = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id)
      .select('+bankDetails.accountNumber +bankDetails.accountHolderName +bankDetails.bankName');

    if (!withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'pending') {
      throw new Error('Details only available for pending withdrawals');
    }

    res.json({
      accountNumber: decrypt(withdrawal.bankDetails.accountNumber),
      accountHolderName: decrypt(withdrawal.bankDetails.accountHolderName),
      bankName: withdrawal.bankDetails.bankName ? decrypt(withdrawal.bankDetails.bankName) : null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};