const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');
const passport = require('passport');
const authRoutes = require('./routes/authRoutes');
const session = require('express-session');
const path = require('path'); 

dotenv.config(); 

const app = express();
const port = process.env.PORT || 3000;

// Configure session middleware
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }, // Use `true` in production with HTTPS
    })
);

// Middleware
app.use(express.json()); 
app.use(passport.initialize()); 
app.use(passport.session()); 
require('./config/passport')(passport); 

// Connect to the database
connectDB();

// Routes
app.use('/auth', authRoutes); 
app.get('/', (req, res) => {
    res.send('Welcome to the Noko Youtube Boost!');
});


if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client/build')));
    app.get('*', (req, res) =>
        res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'))
    );
}

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
