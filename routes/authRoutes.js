const express = require('express');
const authController = require('../controllers/authController');
const passport = require('passport');

const router = express.Router();

router.post('/signup', authController.signup);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/resend-verification', authController.resendVerification);

router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect(`${process.env.CLIENT_URL}/dashboard`);
    }
);

module.exports = router;
