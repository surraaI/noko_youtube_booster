// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadminController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');

// Admin creation route
router.post(
  '/admins',
  authMiddleware,
  roleMiddleware(['superAdmin']),
  superadminController.createAdmin
);

// Get all admins
router.get(
  '/admins',
  authMiddleware,
  roleMiddleware(['superAdmin']),
  superadminController.getAdmins
);

// Deactivate admin
router.delete(
  '/admins/:id',
  authMiddleware,
  roleMiddleware(['superAdmin']),
  superadminController.deactivateAdmin
);

router.get('/metrics', authMiddleware, roleMiddleware(['superAdmin']), superadminController.getPlatformMetrics);
router.get('/withdrawals', authMiddleware, roleMiddleware(['superAdmin']), superadminController.getAllWithdrawals);
router.get('/notifications', authMiddleware, roleMiddleware(['superAdmin']), superadminController.getPlatformNotifications);
router.get('/growth-metrics', authMiddleware, roleMiddleware(['superAdmin']), superadminController.getGrowthMetrics);


module.exports = router;