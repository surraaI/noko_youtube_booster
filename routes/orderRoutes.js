const express = require('express');
const router = express.Router();
const { 
    createOrder, 
    getOrders, 
    getOrderById,
    updateOrder, 
    verifyOrder, 
    cancelOrder,
    getPendingOrders,
    reviewOrder
} = require('../controllers/orderController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');
const { upload } = require('../middlewares/fileUploadMiddleware');

// User creates order
router.post('/create-order', 
    authMiddleware, 
    upload.fields([
      { name: 'paymentScreenshot', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 }
    ]), 
    createOrder
);

// User and Admin view orders
router.get('/', authMiddleware, getOrders);

// Admin view pending orders
router.get('/pending', authMiddleware, roleMiddleware(['admin']), getPendingOrders);

router.get('/:id', authMiddleware, getOrderById);

// User updates order
router.patch('/:id', 
    authMiddleware, 
    upload.fields([
      { name: 'paymentScreenshot', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 }
    ]), 
    updateOrder
);

// Admin verify order (existing one)
router.patch('/:id/verify', authMiddleware, roleMiddleware(['admin']), verifyOrder);


// Admin approve or reject order
router.patch('/:id/review', authMiddleware, roleMiddleware(['admin']), reviewOrder);

// User cancels order
router.delete('/:id', authMiddleware, cancelOrder);

module.exports = router;
