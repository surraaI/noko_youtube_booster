const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const path = require('path');
const connectDB = require('./utils/db');

// Routes
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const referralRoutes = require('./routes/referralRoutes');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Database connection
connectDB();

// Middleware Configuration
// Update CORS configuration to handle multiple origins
const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
  
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Passport configuration
require('./config/passport')(passport);

// Route Handlers
app.use('/auth', authRoutes);
app.use('/orders', orderRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/referrals', referralRoutes);

// Basic route
app.get('/', (req, res) => {
    res.send('Welcome to Noko YouTube Boost!');
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
    console.error(err.stack);
    res.status(500).json({ 
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Server initialization
app.listen(port, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`Listening on port ${port}`);
    console.log(`CORS configured for: ${process.env.CLIENT_URL}`);
});