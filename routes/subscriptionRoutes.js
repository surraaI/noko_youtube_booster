const express = require('express');
const { getAllSubscriptions, manualVerify, uploadScreenshot } = require('../controllers/subscriptionController');
const { validateScreenshotUpload } = require('../middlewares/validationMiddleware');
const { upload } = require('../middlewares/fileUploadMiddleware');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();


router.get('/', authMiddleware, getAllSubscriptions);
router.post('/:id/verify', authMiddleware, manualVerify);

router.post(
    '/upload-screenshot',
    authMiddleware,
    upload.single('screenshot'),
    validateScreenshotUpload,
    uploadScreenshot
);

module.exports = router;
