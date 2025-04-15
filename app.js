const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const path = require('path');
const connectDB = require('./utils/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const referralRoutes = require('./routes/referralRoutes');
const userRoutes = require('./routes/userRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Database connection
connectDB();

// Configure allowed origins
const allowedOrigins = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(',').map(origin => origin.trim()) 
  : [];

// Add debug logging
// Remove the complex origin checking and simplify CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? 'https://your-frontend-domain.com' // Replace with actual frontend URL
    : true, // Allow all in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Transaction-Token'
  ],
  optionsSuccessStatus: 200
};

// Simplify CORS middleware usage
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight for all routes
// Standard middleware
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Passport configuration
require('./config/passport')(passport);

// API Routes
app.use('/auth', authRoutes);
app.use('/orders', orderRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/referrals', referralRoutes);
app.use('/users', userRoutes);
app.use('/withdrawals', withdrawalRoutes);

// Base route
app.get('/', (req, res) => {
  res.send('🚀 Welcome to Noko YouTube Boost API');
});

// Production configuration
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    console.error('🔒 CORS Policy Violation:', req.headers.origin);
    return res.status(403).json({ 
      success: false,
      message: 'Cross-origin request blocked by security policy'
    });
  }

  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(port, () => {
  console.log(`🌐 Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`🔊 Listening on port ${port}`);
  console.log(`🛡️  CORS protection enabled for origins: ${allowedOrigins.join(', ')}`);
});