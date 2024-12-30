const express = require('express');
const passport = require('passport');
const { signup, login, verifyEmail } = require('../controllers/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/verify-email/:token', verifyEmail);

module.exports = router;
