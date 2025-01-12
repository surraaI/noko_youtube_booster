const Subscription = require('../models/Subscription');
const Order = require('../models/Order');

// Fetch all subscription screenshots
const getAllSubscriptions = async (req, res) => {
    try {
        const subscriptions = await Subscription.find().populate('userId', 'name email').populate('orderId', 'title');
        res.status(200).json({ subscriptions });
    } catch (error) {
        console.error('Error fetching subscriptions:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Verify subscription screenshot
const verifySubscription = async (req, res) => {
    try {
        const { id: subscriptionId } = req.params;

        const subscription = await Subscription.findByIdAndUpdate(
            subscriptionId,
            { verified: true },
            { new: true }
        );

        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        res.status(200).json({
            message: 'Subscription verified successfully',
            subscription,
        });
    } catch (error) {
        console.error('Error verifying subscription:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Upload subscription screenshot
const uploadScreenshot = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'Screenshot is required' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const subscription = new Subscription({
            userId: req.user.id,
            orderId,
            screenshot: req.file.path, // Path to the uploaded file
        });

        const savedSubscription = await subscription.save();

        res.status(201).json({
            message: 'Subscription screenshot uploaded successfully',
            subscription: savedSubscription,
        });
    } catch (error) {
        console.error('Error uploading subscription screenshot:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { getAllSubscriptions, verifySubscription, uploadScreenshot };
