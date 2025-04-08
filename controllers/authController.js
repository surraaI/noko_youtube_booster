const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Referral = require('../models/Referral');

// Setup Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '60m' }
    );

    const refreshToken = jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
};

const renderVerificationPage = (title, message, isSuccess = true) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Noko YouTube Booster</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        body {
            background: #0f0f0f;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            background: #212121;
            padding: 2.5rem;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            max-width: 500px;
            width: 90%;
            border: 2px solid ${isSuccess ? '#FF0000' : '#cc0000'};
            animation: fadeIn 0.6s ease-in;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 1.5rem;
            background: ${isSuccess ? '#FF0000' : '#cc0000'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .icon svg {
            width: 40px;
            height: 40px;
            fill: white;
        }

        h1 {
            color: #ffffff;
            margin-bottom: 1rem;
            font-size: 24px;
            font-weight: 500;
        }

        p {
            color: #aaaaaa;
            line-height: 1.6;
            margin-bottom: 2rem;
            font-size: 16px;
        }

        .button {
            background: #FF0000;
            color: white;
            padding: 12px 24px;
            border-radius: 24px;
            text-decoration: none;
            display: inline-block;
            font-weight: 500;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            font-size: 16px;
        }

        .button:hover {
            background: #cc0000;
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(255,0,0,0.3);
        }

        .youtube-brand {
            position: absolute;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .youtube-logo {
            width: 40px;
            height: 40px;
        }

        .brand-text {
            color: white;
            font-size: 24px;
            font-weight: 500;
            letter-spacing: -0.5px;
        }
    </style>
</head>
<body>
    <div class="youtube-brand">
        <svg class="youtube-logo" viewBox="0 0 24 24" fill="#FF0000">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
        </svg>
        <span class="brand-text">Noko Booster</span>
    </div>
    
    <div class="container">
        <div class="icon">
            <svg viewBox="0 0 24 24">
                ${isSuccess ? 
                    '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>' :
                    '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>'
                }
            </svg>
        </div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${process.env.CLIENT_URL}/login" class="button">
            ${isSuccess ? 'Continue to Dashboard' : 'Try Again'}
        </a>
    </div>
</body>
</html>
`;

// Send verification email
const sendVerificationEmail = async (user, token) => {
    const url = `${process.env.BACKEND_URL}/auth/verify-email/${token}`;
    try {
        await transporter.sendMail({
            to: user.email,
            subject: 'Welcome to Noko YouTube Booster - Verify Your Email',
            html: `
                <h1>Welcome to Noko YouTube Booster, ${user.name}!</h1>
                <p>Thank you for signing up. We're excited to have you onboard.</p>
                <p>Please click the link below to verify your email address and complete your registration:</p>
                <a href="${url}" style="color: blue; text-decoration: underline;">Verify Your Email</a>
                <p>If you did not sign up for Noko YouTube Booster, please ignore this email.</p>
                <p>Best regards,<br>The Noko YouTube Booster Team</p>
            `,
        });
        console.log('Verification email sent successfully');
    } catch (error) {
        console.error('Error sending verification email:', error.message);
    }
};

// Validate email format
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// User signup
exports.signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const { referralCode } = req.query;

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userData = {
            name,
            email,
            password: hashedPassword,
            role: 'user',
        };

        let referrer = null;
        if (referralCode) {
            referrer = await User.findOne({ referralCode });
            if (!referrer) {
                return res.status(400).json({ message: 'Invalid referral code' });
            }
            userData.referredBy = referrer._id;
        }

        const newUser = new User(userData);
        const savedUser = await newUser.save();

        // Create referral record if referral code was used
        if (referrer) {
            await Referral.create({
                referrer: referrer._id,
                referee: savedUser._id,
                status: 'pending',
                amount: 0
            });
        }

        const emailToken = jwt.sign({ id: savedUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        await sendVerificationEmail(savedUser, emailToken);

        res.status(201).json({ message: 'Signup successful! Please verify your email.' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};


// Verify email
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.send(renderVerificationPage(
                'Verification Failed',
                'Invalid verification token. Please try registering again.',
                false
            ));
        }

        if (user.isVerified) {
            return res.send(renderVerificationPage(
                'Already Verified',
                'Your email address was already confirmed.',
                true
            ));
        }

        user.isVerified = true;
        await user.save();

        res.send(renderVerificationPage(
            'Email Verified! 🎉',
            'Your email has been successfully verified. You can now log in to your account.'
        ));

    } catch (error) {
        res.send(renderVerificationPage(
            'Verification Failed',
            'The verification link has expired or is invalid. Please request a new verification email.',
            false
        ));
    }
};

// User login with session
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return res.status(400).json({ message: 'Please verify your email' });
        }

        const { accessToken, refreshToken } = generateTokens(user);
        user.refreshToken = refreshToken;
        await user.save();

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ 
            accessToken,
            requiresPasswordChange: user.forcePasswordChange
          });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
}


exports.refreshToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        const accessToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ accessToken });
    } catch (error) {
        res.status(403).json({ message: 'Invalid refresh token' });
    }
};

// logout controller
exports.logout = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    res.clearCookie('refreshToken');

    if (refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            await User.findByIdAndUpdate(decoded.id, { refreshToken: null });
        } catch (error) {
            // Token verification failed, proceed with logout
        }
    }

    res.json({ message: 'Logout successful' });
};

// forgot password controller
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        // Generic response to prevent email enumeration
        if (!user) return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(resetToken, 10);

        // Set token expiration (1 hour)
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = Date.now() + 3600000;
        await user.save();

        // Send email with reset link
        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${encodeURIComponent(resetToken)}&id=${user._id}`;
        await transporter.sendMail({
            to: user.email,
            subject: 'Password Reset Request - Noko Auth',
            html: `
                <h1>Password Reset</h1>
                <p>Click the link to reset your password (expires in 1 hour):</p>
                <a href="${resetUrl}">Reset Password</a>
                <p>If you didn't request this, please ignore this email.</p>
            `,
        });

        res.status(200).json({ message: 'Password reset email sent.' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};

// reset password controller
exports.resetPassword = async (req, res) => {
    try {
        const { token, userId, newPassword } = req.body;
        const user = await User.findById(userId);

        // Validate token and user
        if (!user || !user.passwordResetToken || Date.now() > user.passwordResetExpires) {
            return res.status(400).json({ message: 'Invalid or expired token.' });
        }

        // Verify token
        const isValidToken = await bcrypt.compare(token, user.passwordResetToken);
        if (!isValidToken) return res.status(400).json({ message: 'Invalid token.' });

        // Validate password
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }

        // Update password and clear reset token
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.refreshToken = null; // Invalidate existing sessions
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        // Send confirmation email
        await transporter.sendMail({
            to: user.email,
            subject: 'Password Updated Successfully',
            html: `<p>Your password has been reset successfully.</p>`
        });

        console.log(`Password reset for ${user.email}`); // Security log
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};

// resend verification controller
exports.resendVerification = async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      if (user.isVerified) {
        return res.status(400).json({ message: 'Email is already verified' });
      }
  
      const emailToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { 
        expiresIn: '1h' 
      });
      
      await sendVerificationEmail(user, emailToken);
      
      res.status(200).json({ message: 'Verification email resent' });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  };

// Verify password for transaction
exports.verifyPasswordForTransaction = async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('+password');
      
      if (!await bcrypt.compare(req.body.password, user.password)) {
        return res.status(401).json({ error: 'Invalid password' });
      }
  
      const transactionToken = jwt.sign(
        { 
          userId: user._id, 
          purpose: 'withdrawal', // Must match middleware check
          iat: Math.floor(Date.now() / 1000) // Current timestamp in seconds
        },
        process.env.JWT_SECRET,
        { expiresIn: '5m' } // 5 minutes expiration
      );
  
      res.json({ transactionToken });
    } catch (error) {
      res.status(500).json({ error: 'Verification failed' });
    }
  };

  exports.changePassword = async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      const { currentPassword, newPassword } = req.body;
  
      if (!(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
  
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(newPassword, salt);
      user.forcePasswordChange = false;
      user.temporaryPassword = undefined;
      await user.save();
  
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error changing password' });
    }
  };