const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');
const { verifyTransactionToken } = require('../middlewares/transactionAuth'); 
const { verifyPasswordForTransaction } = require('../controllers/authController');
const User = require('../models/User');

// Password verification endpoint
router.post('/verify-password', 
    authMiddleware,
    verifyPasswordForTransaction
  );

// Withdrawal routes
router.post('/', 
  authMiddleware,
  verifyTransactionToken, // Added middleware here
  withdrawalController.createWithdrawal
);

router.get('/my-withdrawals', 
  authMiddleware,
  withdrawalController.getUserWithdrawals
);

// Admin endpoints
router.get('/pending', 
  authMiddleware,
  roleMiddleware(['admin', 'superAdmin']),
  withdrawalController.getPendingWithdrawals
);

router.put('/:id/process', 
  authMiddleware,
  roleMiddleware(['admin', 'superAdmin']),
  withdrawalController.processWithdrawal
);

router.get('/:id/details',
  authMiddleware,
  roleMiddleware(['admin', 'superAdmin']),
  withdrawalController.getSecureDetails
);

module.exports = router;