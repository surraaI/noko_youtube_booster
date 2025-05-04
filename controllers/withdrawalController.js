// Withdrawal Controller
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');

// Encryption configuration
const ALGORITHM = 'aes-256-ctr';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

const deriveKey = () => crypto.scryptSync(
  process.env.ENCRYPTION_SECRET,
  process.env.ENCRYPTION_SALT,
  KEY_LENGTH
);

const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

const safeDecrypt = (encryptedText) => {
  try {
    const [ivPart, dataPart] = encryptedText.split(':');
    if (!ivPart || !dataPart) throw new Error('Invalid encrypted text');
    const iv = Buffer.from(ivPart, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(), iv);
    return Buffer.concat([decipher.update(Buffer.from(dataPart, 'hex')), decipher.final()]).toString();
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Invalid encrypted data');
  }
};

exports.createWithdrawal = async (req, res) => {
  const session = await User.startSession();
  session.startTransaction();
  let virtualGiftsDeducted, referralBalanceDeducted, availableBalance, fee, netAmount;

  try {
      const { transaction } = req;
      
      if (!transaction || transaction.userId !== req.user.id) {
          throw new Error('Transaction validation failed');
      }

      const user = await User.findById(req.user.id).session(session);
      const { accountNumber, accountHolderName, bankName, method } = req.body;

      // Validation: Account Number
      if (!/^\d{9,18}$/.test(accountNumber)) {
          throw Object.assign(new Error('Invalid account number format'), {
              code: 'INVALID_ACCOUNT_NUMBER',
              details: {
                  received: accountNumber,
                  requirement: '9-18 numeric characters'
              }
          });
      }

      // Validation: Account Holder Name
      if (!/^[\p{L}\p{M}\s-]{5,}$/u.test(accountHolderName)) {
          throw Object.assign(new Error('Invalid account holder name'), {
              code: 'INVALID_ACCOUNT_NAME',
              details: {
                  received: accountHolderName,
                  requirement: 'Minimum 5 letters/hyphens'
              }
          });
      }

      // Calculate amounts
      const virtualGiftsDeducted = parseFloat((user.virtualGifts / 2).toFixed(2));
      const referralBalanceDeducted = parseFloat(user.referralBalance.toFixed(2));
      const availableBalance = virtualGiftsDeducted + referralBalanceDeducted;
      const feePercentage = parseFloat(process.env.TRANSACTION_FEE_PERCENTAGE || 2.5);
      const fee = parseFloat((availableBalance * (feePercentage / 100)).toFixed(2));
      const netAmount = parseFloat((availableBalance - fee).toFixed(2));
      const minWithdrawal = Number(process.env.MIN_WITHDRAWAL || 1000).toFixed(2);

      // Check minimum withdrawal
      if (netAmount < minWithdrawal) {
          const balanceDetails = {
              currentBalances: {
                  virtualGifts: user.virtualGifts.toFixed(2),
                  referralBalance: user.referralBalance.toFixed(2)
              },
              withdrawalCalculation: {
                  availableBalance: availableBalance.toFixed(2),
                  feePercentage: `${feePercentage}%`,
                  feeAmount: fee,
                  netAmount: netAmount.toFixed(2),
                  minimumRequired: minWithdrawal
              }
          };

          throw Object.assign(
            new Error(`Insufficient funds for withdrawal. Net amount: ${netAmount}`),
            { 
                code: 'INSUFFICIENT_FUNDS',
                ...balanceDetails 
            }
          );
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

      // Update user balance
      user.virtualGifts = parseFloat((user.virtualGifts - virtualGiftsDeducted).toFixed(2));
      user.referralBalance = 0;
      await user.save({ session });

      // Audit log
      await AuditLog.create({
        user: user._id,  // Match schema field name
        action: 'WITHDRAWAL_CREATE',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'] || 'Unknown',
        metadata: {
          withdrawalId: withdrawal[0]._id,
          amount: netAmount,
          fee: fee,
          currency: 'USD',
          method: method,
          accountLast4: accountNumber.slice(-4)
        }
      });

      await session.commitTransaction();
      
      res.status(201).json({
          status: 'success',
          data: {
              id: withdrawal[0]._id,
              amount: netAmount,
              fee: fee,
              netAmount: netAmount,
              status: 'pending',
              estimatedProcessing: '3-5 business days'
          }
      });

  } catch (error) {
      await session.abortTransaction();
      
      const response = {
          status: 'error',
          code: error.code || 'WITHDRAWAL_FAILED',
          message: error.message
      };

      // Add validation details if available
      if (error.details) {
          response.validation = error.details;
      }

      // Add balance details for insufficient funds
      if (error.code === 'INSUFFICIENT_FUNDS') {
          response.currentBalances = error.currentBalances;
          response.withdrawalCalculation = error.withdrawalCalculation;
      }

      // Development-only details
      if (process.env.NODE_ENV === 'development') {
          response.stack = error.stack;
          response.debug = {
              rawAmounts: {
                  virtualGiftsDeducted,
                  referralBalanceDeducted,
                  availableBalance,
                  fee,
                  netAmount
              }
          };
      }

      res.status(error.statusCode || 400).json(response);
  } finally {
      session.endSession();
  }
};

exports.getUserWithdrawals = async (req, res) => {
  try {
    // Validate user existence first
    const userExists = await User.exists({ _id: req.user.id });
    if (!userExists) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        error: 'User account not found'
      });
    }

    // Add debug logging
    console.log(`Fetching withdrawals for user: ${req.user.id}`);
    const startTime = Date.now();

    const withdrawals = await Withdrawal.find({ user: req.user.id })
      .sort('-createdAt')
      .lean()
      .transform(results => {
        console.log(`Found ${results.length} withdrawals`);
        return results.map(w => {
          try {
            return {
              ...w,
              bankDetails: {
                accountNumber: `••••${safeDecrypt(w.bankDetails.accountNumber).slice(-4)}`,
                bankName: w.bankDetails.bankName ? safeDecrypt(w.bankDetails.bankName) : 'Unknown Bank'
              }
            };
          } catch (decryptError) {
            console.error('Decryption failed for withdrawal:', w._id, decryptError);
            return {
              ...w,
              bankDetails: {
                error: 'Secure details unavailable'
              }
            };
          }
        });
      });

    console.log(`Withdrawals fetch completed in ${Date.now() - startTime}ms`);
    
    res.json(withdrawals);

  } catch (error) {
    console.error('Withdrawal retrieval error:', {
      userId: req.user.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({ 
      code: 'WITHDRAWAL_RETRIEVAL_FAILED',
      error: 'Failed to retrieve withdrawal history',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
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
        accountNumber: `••••${safeDecrypt(w.bankDetails.accountNumber).slice(-4)}`
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
  try {
    const withdrawal = await Withdrawal.findById(req.params.id).populate('user');
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    withdrawal.status = req.body.status;
    withdrawal.verifiedBy = req.user.id;
    withdrawal.verificationNote = req.body.note;
    withdrawal.verifiedAt = new Date();

    // Only restore balance if rejected
    if (req.body.status === 'rejected') {
      await User.findByIdAndUpdate(
        withdrawal.user._id,
        {
          $inc: {
            virtualGifts: withdrawal.virtualGiftsDeducted,
            referralBalance: withdrawal.referralBalanceDeducted
          }
        }
      );
    }

    await withdrawal.save();

    await AuditLog.create({
      user: req.user.id,
      action: `WITHDRAWAL_${req.body.status.toUpperCase()}`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: {
        withdrawalId: withdrawal._id,
        processedBy: req.user.id,
        previousStatus: 'pending',
        newStatus: req.body.status,
        note: req.body.note
      }
    });

    res.json({
      message: `Withdrawal ${req.body.status} successfully`,
      withdrawal: {
        _id: withdrawal._id,
        status: withdrawal.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message, code: 'WITHDRAWAL_PROCESSING_ERROR' });
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
      accountNumber: safeDecrypt(withdrawal.bankDetails.accountNumber),
      accountHolderName: safeDecrypt(withdrawal.bankDetails.accountHolderName),
      bankName: withdrawal.bankDetails.bankName ? safeDecrypt(withdrawal.bankDetails.bankName) : null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Leaderboard: Top Earners
exports.getLeaderboard = async (req, res) => {
  try {
    const topUsers = await User.find({ role: 'user' })
      .sort({ totalEarnings: -1 }) // Sort by highest earnings
      .limit(20) // Top 20 users
      .select('name email totalEarnings virtualGifts withdrawnAmount profileImage') // Select necessary fields only
      .lean();

    res.json({ leaderboard: topUsers });
  } catch (error) {
    console.error('Leaderboard fetch error:', error.message);
    res.status(500).json({ 
      code: 'LEADERBOARD_FETCH_ERROR',
      message: 'Failed to fetch leaderboard',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
