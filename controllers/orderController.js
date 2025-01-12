const { validationResult } = require('express-validator');
const Order = require('../models/Order');

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
            orders = await Order.find();
        } else {
            orders = await Order.find({ userId });
        }

        res.status(200).json({ orders });
    } catch (error) {
        console.error('Error fetching orders:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update Order (Status)
const updateOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { id: orderId } = req.params;
        const { status } = req.body;

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { status },
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found' });
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

        const canceledOrder = await Order.findByIdAndUpdate(
            orderId,
            { status: 'canceled' },
            { new: true }
        );

        if (!canceledOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

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
