// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const { 
    createOrder, 
    getOrders, 
    getOrderById,
    updateOrder, 
    verifyOrder, 
    cancelOrder, 
    subscribeToOrder 

} = require('../controllers/orderController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const  { roleMiddleware } = require('../middlewares/roleMiddleware');
const { upload } = require('../middlewares/fileUploadMiddleware');



router.post('/create-order', 
    authMiddleware, 
    upload.fields([
      { name: 'paymentScreenshot', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 }
    ]), 
    createOrder
  );

router.get('/', authMiddleware, getOrders);
router.get('/:id', authMiddleware,roleMiddleware(['admin']), getOrderById);

router.patch('/:id', 
    authMiddleware, 
    upload.fields([
      { name: 'paymentScreenshot', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 }
    ]), 
    updateOrder
  );


router.patch('/:id/verify', authMiddleware,  roleMiddleware(['admin']) , verifyOrder);
router.delete('/:id', authMiddleware, cancelOrder);
router.post('/:id/subscribe', authMiddleware, subscribeToOrder);

module.exports = router;