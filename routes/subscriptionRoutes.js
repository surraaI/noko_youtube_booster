const express = require('express');
const { getAllSubscriptions, manualVerify, subscribe } = require('../controllers/subscriptionController');
const { validateScreenshotUpload } = require('../middlewares/validationMiddleware');
const { upload } = require('../middlewares/fileUploadMiddleware');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');

const router = express.Router();


router.get('/', authMiddleware, getAllSubscriptions);

router.post(
    '/subscribe',
    authMiddleware,
    upload.single('screenshot'),
    validateScreenshotUpload,
    subscribe
);

module.exports = router;
