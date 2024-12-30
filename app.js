const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');
const passport = require('passport');
const authRoutes = require('./routes/authRoutes'); // Import the authRoutes

dotenv.config(); // Load environment variables

const app = express();
const port = 3000;

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(passport.initialize()); // Initialize Passport
require('./config/passport')(passport); // Configure Passport

// Connect to the database
connectDB();

// Routes
app.use('/auth', authRoutes); // Auth routes
app.get('/', (req, res) => {
    res.send('Welcome to the Noko Youtube Boost!');
});

// Start the server
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
