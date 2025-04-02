// routes/referralRoutes.js
const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// User routes
router.post('/apply', authMiddleware, referralController.applyReferralCode);
router.get('/stats', authMiddleware, referralController.getReferralStats);

module.exports = router;