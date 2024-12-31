const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

module.exports = router;
