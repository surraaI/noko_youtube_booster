const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');

// Encryption configuration
const ALGORITHM = 'aes-256-ctr';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

const deriveKey = () => {
  return crypto.scryptSync(
    process.env.ENCRYPTION_SECRET,
    process.env.ENCRYPTION_SALT,
    KEY_LENGTH
  );
};

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
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'hex')), 
      decipher.final()
    ]).toString();
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
          userId: user._id,
          action: 'WITHDRAWAL_CREATE',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: {
              withdrawalId: withdrawal[0]._id,
              amount: netAmount,
              fee: fee,
              currency: 'USD'
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
    const withdrawals = await Withdrawal.find({ user: req.user.id })
      .sort('-createdAt')
      .lean()
      .transform(results => results.map(w => ({
        ...w,
        bankDetails: {
          accountNumber: `••••${safeDecrypt(w.bankDetails.accountNumber).slice(-4)}`,
          bankName: w.bankDetails.bankName ? safeDecrypt(w.bankDetails.bankName) : null
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

    // Audit log entry
    await AuditLog.create({
      user: req.user.id,
      action: `Withdrawal ${req.body.status}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        status: req.body.status
      }
    });

    await session.commitTransaction();
    
    res.json({
      message: `Withdrawal ${req.body.status} successfully`,
      withdrawal: {
        ...withdrawal.toObject(),
        bankDetails: {
          accountNumber: `••••${safeDecrypt(withdrawal.bankDetails.accountNumber).slice(-4)}`
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
      accountNumber: safeDecrypt(withdrawal.bankDetails.accountNumber),
      accountHolderName: safeDecrypt(withdrawal.bankDetails.accountHolderName),
      bankName: withdrawal.bankDetails.bankName ? safeDecrypt(withdrawal.bankDetails.bankName) : null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};