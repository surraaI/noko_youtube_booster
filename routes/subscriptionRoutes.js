const express = require('express');
const { getAllSubscriptions, verifySubscription, uploadScreenshot } = require('../controllers/subscriptionController');
const { validateScreenshotUpload } = require('../middlewares/validationMiddleware');
const { upload } = require('../middlewares/fileUploadMiddleware');
const { authMiddleware } = require('../middlewares/authMiddleware'); // Assuming RBAC middleware exists

const router = express.Router();

router.get('/', authMiddleware, getAllSubscriptions);
router.patch('/:id/verify', authMiddleware, verifySubscription);
router.post(
    '/',
    authMiddleware,
    upload.single('screenshot'),
    validateScreenshotUpload,
    uploadScreenshot
);

module.exports = router;
