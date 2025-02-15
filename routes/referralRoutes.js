// routes/referralRoutes.js
const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// User routes
router.post('/apply', authMiddleware, referralController.applyReferralCode);
router.get('/stats', authMiddleware, referralController.getReferralStats);
router.post('/payout', authMiddleware, referralController.requestPayout);
// router.get('/code', referralController.getReferralCode);


// Admin routes
// Add admin middleware and other admin-specific endpoints here

module.exports = router;