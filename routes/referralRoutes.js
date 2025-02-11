// routes/referralRoutes.js
const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const auth = require('../middlewares/authMiddleware');

// User routes
router.post('/apply', referralController.applyReferralCode);
router.get('/stats', referralController.getReferralStats);
router.post('/payout', referralController.requestPayout);
// router.get('/code', referralController.getReferralCode);


// Admin routes
// Add admin middleware and other admin-specific endpoints here

module.exports = router;