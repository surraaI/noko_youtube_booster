// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.get('/me', authMiddleware, userController.getCurrentUser);
router.put('/profile', authMiddleware, userController.updateUserProfile);
router.get('/coin-stats', authMiddleware, userController.getCoinStats);

module.exports = router;