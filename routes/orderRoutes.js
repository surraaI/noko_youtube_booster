const express = require('express');
const { 
    createOrder, 
    getOrders, 
    updateOrder, 
    cancelOrder 
} = require('../controllers/orderController');
const { validateOrder, validateOrderUpdate } = require('../middlewares/validationMiddleware');
const { authMiddleware } = require('../middlewares/authMiddleware'); 

const router = express.Router();


router.post('/', authMiddleware, validateOrder, createOrder);
router.get('/', authMiddleware, getOrders);
router.put('/:id', authMiddleware, validateOrderUpdate, updateOrder);
router.patch('/:id/cancel', authMiddleware, cancelOrder);

module.exports = router;
