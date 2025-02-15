// controllers/subscriptionController.js
const Tesseract = require('tesseract.js');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const User = require('../models/User');

// OCR Text Extraction
const extractText = async (imagePath) => {
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: (m) => console.log(m),
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789- ',
    });
    return text.toLowerCase();
  } catch (error) {
    console.error('OCR Error:', error);
    return '';
  }
};

// Direct Verification Check
const verifyContent = (extractedText, channelName) => {
  // Normalize channel name: lowercase + remove spaces
  const targetChannel = channelName.toLowerCase().replace(/\s/g, '');
  
  // Normalize OCR text: lowercase + remove spaces
  const cleanText = extractedText.replace(/\s/g, '');
  
  // Check conditions
  const hasChannel = cleanText.includes(targetChannel);
  const hasSubscribed = extractedText.includes('subscribed');

  console.log('Verification Check:', {
    targetChannel,
    cleanText,
    hasChannel,
    hasSubscribed
  });

  return hasChannel && hasSubscribed;
};

// Main Controller
const uploadScreenshot = async (req, res) => {
  const session = await Order.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!req.file || !orderId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Screenshot and order ID required' });
    }

    // Check existing subscription
    const existingSub = await Subscription.findOne({ userId, orderId }).session(session);
    if (existingSub) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Already subscribed to this order' });
    }

    // Get order
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }

    // Process OCR
    const extractedText = await extractText(req.file.path);
    console.log('Raw OCR Text:', extractedText);

    // Verify content
    const isVerified = verifyContent(extractedText, order.channelName);

    // Create subscription
    const subscription = new Subscription({
      userId,
      orderId,
      screenshot: req.file.path,
      verified: isVerified,
    });

    const savedSubscription = await subscription.save({ session });

    // Update order and user if verified
    if (isVerified) {
      order.subscribed += 1;
      if (order.subscribed >= order.subscribersNeeded) {
        order.status = 'completed';
      }
      await order.save({ session });

      const user = await User.findById(userId).session(session);
      user.balance += 5;
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

    res.status(500).json({
      message: error.code === 11000 
        ? 'Duplicate subscription detected' 
        : 'Server processing error',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Additional Controllers
const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
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
  uploadScreenshot,
  getAllSubscriptions,
  manualVerify
};