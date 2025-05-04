// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { upload } = require('../middlewares/fileUploadMiddleware');

router.get('/me', authMiddleware, userController.getCurrentUser);
router.put('/profile', authMiddleware, userController.updateUserProfile);
router.get('/coin-stats', authMiddleware, userController.getCoinStats);
router.post('/upload-avatar', authMiddleware, upload.single('avatar'), userController.uploadAvatar);

module.exports = router;