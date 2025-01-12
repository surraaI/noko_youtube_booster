const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');
const passport = require('passport');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
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

// for testing purpose only 

// app.use((req, res, next) => {
//     req.user = {
//         id: '6783e20b0db868adfd22e013', // Replace with a valid user ID from your database
//         role: 'user', // Or 'admin', 'superadmin'
//     };
//     next();
// });


// Middleware
app.use(express.json()); 
app.use(passport.initialize()); 
app.use(passport.session()); 
require('./config/passport')(passport); 

// Connect to the database
connectDB();

// Routes
app.use('/auth', authRoutes); 
app.use('/orders', orderRoutes);
app.use('/subscriptions', subscriptionRoutes);
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
