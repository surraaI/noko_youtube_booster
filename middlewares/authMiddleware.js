const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or invalid' });
    }

    // 2. Extract and verify token
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Fetch fresh user data from DB
    const user = await User.findById(decoded.id)
      .select('-password -refreshToken'); // Exclude sensitive fields

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // 4. Attach user to request
    req.user = user;
    next();

  } catch (err) {
    // Handle specific JWT errors
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Generic error handler
    console.error('Authentication error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { authMiddleware };