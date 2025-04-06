// controllers/subscriptionController.js
const Tesseract = require('tesseract.js');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const User = require('../models/User');
const sharp = require('sharp');
const mongoose = require('mongoose');
const axios = require('axios');
const { cloudinary } = require('../utils/cloudinary');

// Helper to extract username from YouTube link
const extractUsernameFromLink = (youtubeLink) => {
  const match = youtubeLink.match(/@([\w-]+)/);
  if (!match || !match[1]) {
    throw new Error('Invalid YouTube link format - missing username');
  }
  return match[1].toLowerCase();
};

// OCR Text Extraction with Cloudinary integration
const extractText = async (imageUrl) => {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');

    const processedImage = await sharp(imageBuffer)
      .resize({ width: 2000, kernel: sharp.kernel.cubic })
      .linear(1.1, -50)
      .modulate({ brightness: 1.2 })
      .median(3)
      .sharpen({ sigma: 2, flat: 1, jagged: 2 })
      .threshold(128, { adaptiveWindowSize: true })
      .toBuffer();

    const { data: { text } } = await Tesseract.recognize(processedImage, 'eng', {
      logger: info => console.debug(info),
      tessedit_char_whitelist: '@abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_ ',
      tessedit_pageseg_mode: 11,
      tessedit_ocr_engine_mode: 4,
      preserve_interword_spaces: 1,
      user_defined_dpi: 300,
      textord_min_linesize: 2.5,
    });

    return text.toLowerCase();
  } catch (error) {
    console.error('OCR Error:', error);
    return '';
  }
};

// Enhanced Verification Check with fuzzy matching
const verifyContent = (extractedText, username) => {
  const targetUsername = username.toLowerCase().replace(/\s/g, '');
  const cleanText = extractedText.replace(/\s/g, '').replace(/[^a-z0-9@-_]/g, '');

  const usernameRegex = new RegExp(
    `@?${targetUsername.split('').join('[ _-]?')}[ _-]?`,
    'i'
  );

  const hasUsername = usernameRegex.test(cleanText);
  const hasSubscribed = /subscribed/i.test(extractedText);

  console.log('Enhanced Verification:', {
    targetUsername,
    cleanText,
    hasUsername,
    hasSubscribed
  });

  return hasUsername && hasSubscribed;
};

// Updated Subscribe Controller with proper transaction handling
const subscribe = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { orderId } = req.body;
      const userId = req.user.id;

      if (!req.file || !orderId) {
        throw new Error('Missing required fields');
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const screenshotInfo = {
        url: req.file.path.includes('http') 
          ? req.file.path 
          : `https://res.cloudinary.com/${cloudName}/image/upload/${req.file.path}`,
        public_id: req.file.filename
      };

      const existingSub = await Subscription.findOne({ userId, orderId }).session(session);
      if (existingSub) {
        throw new Error('You have already subscribed to this channel');
      }

      const order = await Order.findById(orderId).session(session);
      if (!order || order.userId.toString() === userId.toString()) {
        throw new Error(order ? 'Cannot subscribe to own order' : 'Order not found');
      }

      const username = extractUsernameFromLink(order.youtubeLink);
      const extractedText = await extractText(screenshotInfo.url);
      const isVerified = verifyContent(extractedText, username);
      if (!isVerified) {
        throw new Error('Verification failed');
      }

      const [subscription] = await Subscription.create([{
        userId,
        orderId,
        screenshot: screenshotInfo,
        verified: true
      }], { session });

      await Order.findByIdAndUpdate(
        orderId,
        { 
          $inc: { subscribed: 1 },
          $set: { 
            status: order.subscribed + 1 >= order.subscribersNeeded 
              ? 'completed' 
              : 'active' 
          }
        },
        { new: true, session }
      );

      await User.findByIdAndUpdate(
        userId,
        { $inc: { virtualGifts: 10 } },
        { session }
      );

      const populatedSub = await Subscription.findById(subscription._id)
        .populate('userId', 'name email')
        .populate('orderId', 'channelName');

      res.status(201).json({
        message: 'Subscription verified and created',
        subscription: populatedSub,
        coinsAwarded: 10
      });
    }, { 
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });
  } catch (error) {
    if (req.file?.filename) {
      await cloudinary.uploader.destroy(req.file.filename);
    }

    console.error('Subscription Error:', error);
    const statusCode = error.message.includes('already subscribed') ? 409 : 
                      error.message.includes('Verification') ? 400 : 500;
    
    res.status(statusCode).json({
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    await session.endSession();
  }
};


const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.user.id })
      .populate('userId', 'name email')
      .populate('orderId', 'channelName');
    
    res.status(200).json({ subscriptions });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const manualVerify = async (req, res) => {
  const session = await Order.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const subscription = await Subscription.findById(id).session(session);

    if (!subscription) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Subscription not found' });
    }

    if (subscription.verified) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Already verified' });
    }

    subscription.verified = true;
    await subscription.save({ session });

    const [order, user] = await Promise.all([
      Order.findById(subscription.orderId).session(session),
      User.findById(subscription.userId).session(session)
    ]);

    order.subscribed += 1;
    if (order.subscribed >= order.subscribersNeeded) {
      order.status = 'completed';
    }
    await order.save({ session });

    user.balance += 5;
    await user.save({ session });

    await session.commitTransaction();
    res.status(200).json({ message: 'Manually verified', subscription });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    session.endSession();
  }
};

const deleteSubscriptionScreenshot = async (public_id) => {
  try {
    if (public_id) {
      await cloudinary.uploader.destroy(public_id);
    }
  } catch (error) {
    console.error('Error deleting subscription screenshot:', error);
  }
};

module.exports = {
  subscribe,
  getAllSubscriptions,
  manualVerify
};