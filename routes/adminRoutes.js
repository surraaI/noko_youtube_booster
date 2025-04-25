// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
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

module.exports = router;