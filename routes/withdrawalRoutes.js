const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');

// Password verification endpoint
router.post('/verify-password', 
  authMiddleware,
  async (req, res) => {
    try {
      const { password } = req.body;
      const user = await User.findById(req.user.id).select('+password');
      
      if (!await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      const transactionToken = jwt.sign(
        { userId: user._id, purpose: 'withdrawal' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      res.json({ transactionToken });

    } catch (error) {
      res.status(500).json({ error: 'Verification failed' });
    }
  }
);

// Withdrawal creation (requires transaction token)
router.post('/withdrawals', 
  authMiddleware,
  withdrawalController.createWithdrawal
);

// User withdrawal history
router.get('/withdrawals/my-withdrawals', 
  authMiddleware,
  withdrawalController.getUserWithdrawals
);

// Admin endpoints
router.get('/withdrawals/pending', 
  authMiddleware,
  roleMiddleware(['admin', 'superAdmin']),
  withdrawalController.getPendingWithdrawals
);

router.put('/withdrawals/:id/process', 
  authMiddleware,
  roleMiddleware(['admin', 'superAdmin']),
  withdrawalController.processWithdrawal
);

// Secure bank details access
router.get('/withdrawals/:id/details',
  authMiddleware,
  roleMiddleware(['admin', 'superAdmin']),
  withdrawalController.getSecureDetails
);

module.exports = router;