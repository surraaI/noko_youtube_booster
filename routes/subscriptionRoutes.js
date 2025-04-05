const express = require('express');
const { getAllSubscriptions, manualVerify, subscribe } = require('../controllers/subscriptionController');
const { validateScreenshotUpload } = require('../middlewares/validationMiddleware');
const { upload } = require('../middlewares/fileUploadMiddleware');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');

const router = express.Router();


router.get('/', authMiddleware, getAllSubscriptions);

router.post('/subscribe', 
    authMiddleware, // Add this first
    upload.single('screenshot'),
    (req, res, next) => {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      next();
    },
    subscribe
  );

module.exports = router;
