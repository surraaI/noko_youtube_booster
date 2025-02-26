const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const config = require('../config/referralConfig');


// create Order 
const createOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { youtubeLink, channelName, amountPaid, description } = req.body;

        if (!req.files?.['paymentScreenshot'] || !req.files?.['thumbnail']) {
            return res.status(400).json({ 
                message: 'Both payment screenshot and thumbnail are required' 
            });
        }

        const newOrder = new Order({
            userId: req.user.id,
            youtubeLink,
            thumbnail: req.files['thumbnail'][0].path,
            channelName,
            amountPaid,
            description,
            paymentScreenshot: req.files['paymentScreenshot'][0].path,
            status: 'pending' 
        });

        const savedOrder = await newOrder.save();
        
        res.status(201).json({
            message: 'Order created successfully',
            order: savedOrder,
        });
    } catch (error) {
        console.error('Error creating order:', error.message);
        res.status(500).json({ message: error.message.includes('validation') ? error.message : 'Internal server error' });
    }
};

// Get Orders - All active orders + user's own orders
const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            $or: [
                { status: 'active' },
                { userId: req.user.id }
            ]
        })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 });

        res.status(200).json({ orders });
    } catch (error) {
        console.error('Error fetching orders:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get Order by ID
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('userId', 'name email')
            .lean();

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Authorization check
        const isOwner = order.userId._id.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        if (order.status !== 'active' && !isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        // Add virtual fields
        const orderWithVirtuals = {
            ...order,
            remainingSubscribers: order.subscribersNeeded - order.subscribed,
            progress: ((order.subscribed / order.subscribersNeeded) * 100).toFixed(1)
        };

        // Remove sensitive fields for non-owners/admins
        if (!isOwner && !isAdmin) {
            delete orderWithVirtuals.paymentScreenshot;
            delete orderWithVirtuals.userId;
        }

        res.status(200).json(orderWithVirtuals);

    } catch (error) {
        console.error('Error fetching order:', error.message);
        
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update Order - Only order owner can update
const updateOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Authorization check - only owner can update
        if (order.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        // Prevent updates to completed/canceled orders
        if (['completed', 'canceled'].includes(order.status)) {
            return res.status(400).json({ message: 'Cannot modify completed or canceled orders' });
        }

        // Prepare update data
        const updateData = {
            ...req.body,
            ...(req.files?.['paymentScreenshot'] && { 
                paymentScreenshot: req.files['paymentScreenshot'][0].path 
            }),
            ...(req.files?.['thumbnail'] && { 
                thumbnail: req.files['thumbnail'][0].path 
            })
        };

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            message: 'Order updated successfully',
            order: updatedOrder,
        });
    } catch (error) {
        console.error('Error updating order:', error.message);
        res.status(500).json({ message: error.message.includes('validation') ? error.message : 'Internal server error' });
    }
};

// Subscribe to Order - Any user except order owner
const subscribeToOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Prevent owner from subscribing to their own order
        if (order.userId.toString() === req.user.id) {
            return res.status(400).json({ message: 'Cannot subscribe to your own order' });
        }

        if (order.status !== 'active') {
            return res.status(400).json({ message: 'Order is not available for subscriptions' });
        }

        if (order.remainingSubscribers <= 0) {
            return res.status(400).json({ message: 'Order subscription quota filled' });
        }

        const existingSub = await Subscription.findOne({
            order: order._id,
            subscriber: req.user.id
        });

        if (existingSub) {
            return res.status(400).json({ message: 'Already subscribed to this order' });
        }

        const session = await Order.startSession();
        session.startTransaction();

        try {
            await Subscription.create([{
                order: order._id,
                subscriber: req.user.id
            }], { session });

            order.subscribed += 1;
            order.remainingSubscribers -= 1;
            
            if (order.subscribed >= order.subscribersNeeded) {
                order.status = 'completed';
            }

            await order.save({ session });
            await User.findByIdAndUpdate(
                req.user.id,
                { $inc: { balance: 5 } },
                { session }
            );

            await session.commitTransaction();
            res.status(200).json({ message: 'Subscription recorded successfully' });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error('Error processing subscription:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};


// Verify Order (Admin)
const verifyOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (order.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending orders can be verified' });
        }

        // Ensure payment screenshot exists
        if (!order.paymentScreenshot) {
            return res.status(400).json({ message: 'Order has no payment proof' });
        }

        // Update order status
        order.status = 'active';
        order.verifiedBy = req.user.id;
        order.verifiedAt = new Date();
        await order.save();

        // Check if user was referred
        const user = await User.findById(order.userId);
        if (user && user.referredBy) {
            const referrer = await User.findById(user.referredBy);
            if (referrer) {
                const commission = order.amountPaid * config.commissionRate; 
                referrer.referralBalance += commission;
                await referrer.save();
            }
        }

        res.status(200).json({
            message: 'Order verified and activated. Commission processed if applicable.',
            order
        });
    } catch (error) {
        console.error('Error verifying order:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Cancel Order
const cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (['completed', 'canceled'].includes(order.status)) {
            return res.status(400).json({ message: 'Cannot cancel completed or canceled order' });
        }

        if (req.user.role === 'youtuber' && order.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized to cancel this order' });
        }

        order.status = 'canceled';
        await order.save();

        res.status(200).json({
            message: 'Order canceled successfully',
            order
        });
    } catch (error) {
        console.error('Error canceling order:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};



module.exports = { 
    createOrder, 
    getOrders, 
    getOrderById,
    updateOrder, 
    verifyOrder, 
    cancelOrder, 
    subscribeToOrder 
};