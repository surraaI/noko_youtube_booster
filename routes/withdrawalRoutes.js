const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');
const { verifyTransactionToken } = require('../middlewares/transactionAuth'); 
const { verifyPasswordForTransaction } = require('../controllers/authController');
const { getLeaderboard } = require('../controllers/withdrawalController');

// 🔐 Users verify their password for withdrawal
router.post('/verify-password', 
  authMiddleware,
  verifyPasswordForTransaction
);

// 🧾 User-initiated withdrawal (protected by password + token)
router.post('/', 
  authMiddleware,
  verifyTransactionToken,
  withdrawalController.createWithdrawal
);

// 🧾 User's own withdrawal history
router.get('/my-withdrawals', 
  authMiddleware,
  withdrawalController.getUserWithdrawals
);

// 📦 Admin-only: View pending withdrawal requests
router.get('/pending', 
  authMiddleware,
  roleMiddleware(['admin', 'superAdmin']),
  withdrawalController.getPendingWithdrawals
);

// ✅ Admin-only: Approve/Reject a withdrawal request
router.put('/:id/process', 
  authMiddleware,
  roleMiddleware(['admin', 'superAdmin']),
  withdrawalController.processWithdrawal
);

// 🔍 Admin-only: See full bank details for manual transfer
router.get('/:id/details',
  authMiddleware,
  roleMiddleware(['admin', 'superAdmin']),
  withdrawalController.getSecureDetails
);

router.get('/leaderboard', authMiddleware, getLeaderboard);

module.exports = router;
