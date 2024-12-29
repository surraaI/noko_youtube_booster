const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const connectDB = require('./utils/db'); 


dotenv.config();
connectDB();

const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.send('Welcome to the Noko Youtube Boost!');
    });

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
    }
);
