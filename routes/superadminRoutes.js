// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/superadminController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

// Admin creation route
router.post(
  '/admins',
  authMiddleware,
  roleMiddleware(['superAdmin']),
  adminController.createAdmin
);

// Get all admins
router.get(
  '/admins',
  authMiddleware,
  roleMiddleware(['superAdmin']),
  adminController.getAdmins
);

// Deactivate admin
router.delete(
  '/admins/:id',
  authMiddleware,
  roleMiddleware(['superAdmin']),
  adminController.deactivateAdmin
);

router.get('/superadmin/metrics', authMiddleware, roleMiddleware(['superAdmin']), superadminController.getPlatformMetrics);
router.get('/superadmin/withdrawals', authMiddleware, roleMiddleware(['superAdmin']), superadminController.getAllWithdrawals);
router.get('/superadmin/notifications', authMiddleware, roleMiddleware(['superAdmin']), superadminController.getPlatformNotifications);


module.exports = router;