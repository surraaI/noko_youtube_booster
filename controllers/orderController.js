const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const { processReferralCommission } = require('../utils/handleReferral');

// Create Order
const createOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { youtubeLink, thumbnail, title, amountPaid, description } = req.body;

        const newOrder = new Order({
            userId: req.user.id,
            youtubeLink,
            thumbnail,
            title,
            amountPaid,
            description,
            status: 'pending' // Add initial status
        });

        const savedOrder = await newOrder.save();
        
        res.status(201).json({
            message: 'Order created successfully',
            order: savedOrder,
        });
    } catch (error) {
        console.error('Error creating order:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// View Orders (By User or All for Admin)
const getOrders = async (req, res) => {
    try {
        const { id: userId, role } = req.user;

        let orders;
        if (role === 'admin' || role === 'superadmin') {
            orders = await Order.find().populate('userId', 'name email');
        } else {
            orders = await Order.find({ userId }).populate('userId', 'name email');
        }

        res.status(200).json({ orders });
    } catch (error) {
        console.error('Error fetching orders:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update Order 
const updateOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { id: orderId } = req.params;
        const { youtubeLink, thumbnail, title, amountPaid, description, status } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const previousStatus = order.status;

        // Update order fields
        order.youtubeLink = youtubeLink || order.youtubeLink;
        order.thumbnail = thumbnail || order.thumbnail;
        order.title = title || order.title;
        order.amountPaid = amountPaid ?? order.amountPaid;
        order.description = description || order.description;
        order.status = status || order.status;

        const updatedOrder = await order.save();

        // Handle referral commission on successful payment
        if (previousStatus !== 'completed' && updatedOrder.status === 'completed') {
            try {
                await processReferralCommission(updatedOrder);
            } catch (referralError) {
                console.error('Referral processing failed:', referralError);
                // Continue with response even if referral processing fails
            }
        }

        res.status(200).json({
            message: 'Order updated successfully',
            order: updatedOrder,
        });
    } catch (error) {
        console.error('Error updating order:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Cancel Order
const cancelOrder = async (req, res) => {
    try {
        const { id: orderId } = req.params;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Prevent cancellation of completed orders
        if (order.status === 'completed') {
            return res.status(400).json({ message: 'Completed orders cannot be canceled' });
        }

        order.status = 'canceled';
        const canceledOrder = await order.save();

        res.status(200).json({
            message: 'Order canceled successfully',
            order: canceledOrder,
        });
    } catch (error) {
        console.error('Error canceling order:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { createOrder, getOrders, updateOrder, cancelOrder };