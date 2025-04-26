const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const config = require('../config/referralConfig');
const { cloudinary } = require('../utils/cloudinary');
const AuditLog = require('../models/AuditLog'); 


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

        const [thumbnailUpload, paymentUpload] = await Promise.all([
            cloudinary.uploader.upload(req.files['thumbnail'][0].path),
            cloudinary.uploader.upload(req.files['paymentScreenshot'][0].path)
        ]);        

        const newOrder = new Order({
            userId: req.user.id,
            youtubeLink,
            thumbnail: {
                url: thumbnailUpload.secure_url,
                public_id: thumbnailUpload.public_id
            },
            channelName,
            amountPaid,
            description,
            paymentScreenshot: {
                url: paymentUpload.secure_url,
                public_id: paymentUpload.public_id
            },
            status: 'pending' 
        });

        const savedOrder = await newOrder.save();

        // 🔥 Create notification for admins
        await AuditLog.create({
            user: req.user.id,
            action: 'ORDER_CREATED',
            metadata: {
              orderId: savedOrder._id,
              createdBy: req.user.id
            },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'] || 'Unknown'
          });

        res.status(201).json({
            message: 'Order created successfully',
            order: savedOrder,
        });
    } catch (error) {
        console.error('Error creating order:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Modified updateOrder
const updateOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (order.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        if (['completed', 'canceled'].includes(order.status)) {
            return res.status(400).json({ message: 'Cannot modify completed or canceled orders' });
        }

        // Handle file updates
        const updateData = { ...req.body };
        
        if (req.files?.['paymentScreenshot']) {
            // Delete old payment screenshot
            if (order.paymentScreenshot?.public_id) {
                await cloudinary.uploader.destroy(order.paymentScreenshot.public_id);
            }
            const paymentUpload = await cloudinary.uploader.upload(req.files['paymentScreenshot'][0].path);
            updateData.paymentScreenshot = {
                url: paymentUpload.secure_url,
                public_id: paymentUpload.public_id
            };
        }

        if (req.files?.['thumbnail']) {
            // Delete old thumbnail
            if (order.thumbnail?.public_id) {
                await cloudinary.uploader.destroy(order.thumbnail.public_id);
            }
            const thumbnailUpload = await cloudinary.uploader.upload(req.files['thumbnail'][0].path);
            updateData.thumbnail = {
                url: thumbnailUpload.secure_url,
                public_id: thumbnailUpload.public_id
            };
        }

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
        res.status(500).json({ message: 'Internal server error' });
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

// Get pending orders (Admins)
const getPendingOrders = async (req, res) => {
    try {
        const pendingOrders = await Order.find({ status: 'pending' })
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json(pendingOrders);
    } catch (error) {
        console.error('Error fetching pending orders:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Approve or reject pending order (Admins)
const reviewOrder = async (req, res) => {
    try {
        const { decision } = req.body; // decision = 'approved' or 'rejected'
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending orders can be reviewed' });
        }

        if (decision === 'approved') {
            order.status = 'active';
            order.verifiedBy = req.user.id;
            order.verifiedAt = new Date();
        } else if (decision === 'rejected') {
            order.status = 'canceled';
        } else {
            return res.status(400).json({ message: 'Invalid decision' });
        }

        await order.save();

        res.status(200).json({
            message: `Order ${decision} successfully`,
            order
        });
    } catch (error) {
        console.error('Error reviewing order:', error.message);
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
    getPendingOrders,
    reviewOrder 
};