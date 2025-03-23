// controllers/subscriptionController.js
const Tesseract = require('tesseract.js');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const User = require('../models/User');

// Helper to extract username from YouTube link
const extractUsernameFromLink = (youtubeLink) => {
  const match = youtubeLink.match(/@([\w-]+)/);
  if (!match || !match[1]) {
    throw new Error('Invalid YouTube link format - missing username');
  }
  return match[1].toLowerCase();
};

// OCR Text Extraction (updated character whitelist)
const extractText = async (imagePath) => {
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: (m) => console.log(m),
      tessedit_char_whitelist: '@ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_ ',
    });
    return text.toLowerCase();
  } catch (error) {
    console.error('OCR Error:', error);
    return '';
  }
};

// Updated Verification Check
const verifyContent = (extractedText, username) => {
  // Normalize inputs
  const targetUsername = username.toLowerCase().replace(/\s/g, '');
  const cleanText = extractedText.replace(/\s/g, '');

  // Check for both @username and username formats
  const hasUsername = cleanText.includes(targetUsername) || 
                     cleanText.includes(`@${targetUsername}`);
  const hasSubscribed = extractedText.includes('subscribed');

  console.log('Verification Check:', {
    targetUsername,
    cleanText,
    hasUsername,
    hasSubscribed
  });

  return hasUsername && hasSubscribed;
};

// Updated Subscribe Controller
const subscribe = async (req, res) => {
  const session = await Order.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    if (!req.file || !orderId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Screenshot and order ID required' });
    }

    const existingSub = await Subscription.findOne({ userId, orderId }).session(session);
    if (existingSub) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Already subscribed to this order' });
    }

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId.toString() === userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Cannot subscribe to your own order' });
    }

    // Extract username from YouTube link
    const username = extractUsernameFromLink(order.youtubeLink);
    
    const extractedText = await extractText(req.file.path);
    console.log('Raw OCR Text:', extractedText);

    const isVerified = verifyContent(extractedText, username);

    const subscription = new Subscription({
      userId,
      orderId,
      screenshot: req.file.path,
      verified: isVerified,
    });

    const savedSubscription = await subscription.save({ session });

    if (isVerified) {
      order.subscribed += 1;
      if (order.subscribed >= order.subscribersNeeded) {
        order.status = 'completed';
      }
      await order.save({ session });

      const user = await User.findById(userId).session(session);
      user.virtualGifts += 10;
      await user.save({ session });
    }

    await session.commitTransaction();

    res.status(201).json({
      message: isVerified 
        ? 'Subscription automatically verified' 
        : 'Pending manual verification',
      subscription: savedSubscription
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error:', error);

    const message = error.message.startsWith('Invalid YouTube link') 
      ? 'Invalid YouTube channel format in order'
      : error.code === 11000 
        ? 'Duplicate subscription detected' 
        : 'Server processing error';

    res.status(500).json({
      message,
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

/// controllers/subscriptionController.js
const getAllSubscriptions = async (req, res) => {
  try {
    // Filter subscriptions by current user
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

    // Manual verification
    subscription.verified = true;
    await subscription.save({ session });

    // Update order and user
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

module.exports = {
  subscribe,
  getAllSubscriptions,
  manualVerify
};