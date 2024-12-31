const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Setup Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Send verification email
const sendVerificationEmail = async (user, token) => {
    const url = `${process.env.CLIENT_URL}/verify-email/${token}`;
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
        const { name, email, password, role } = req.body;

        // Validate email format
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'user',
        });

        const savedUser = await newUser.save();

        // Generate verification token
        const emailToken = jwt.sign({ id: savedUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Send verification email
        await sendVerificationEmail(savedUser, emailToken);

        res.status(201).json({ message: 'Signup successful! Please verify your email to activate your account.' });
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
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }

        user.isVerified = true;
        await user.save();

        res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Invalid or expired token' });
    }
};

// User login with session
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return res.status(400).json({ message: 'Please verify your email to log in' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Store user in session
        req.session.user = { id: user._id, role: user.role };
        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// User logout
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ message: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout successful' });
    });
};
