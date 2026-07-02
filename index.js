const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
const { initializeFirebase } = require('./services/firebase');
initializeFirebase();

// Initialize Twilio
const { initializeTwilio } = require('./services/twilio');
initializeTwilio();

// Middleware — these two lines let Express read JSON from requests
app.use(express.json());
app.use(cors());

// Connect orders routes
const ordersRouter = require('./routes/orders');
app.use('/orders', ordersRouter);

// Connect menu routes
const menuRouter = require('./routes/menu');
app.use('/menu', menuRouter);

// Connect M-Pesa routes
const mpesaRouter = require('./routes/mpesa');
app.use('/mpesa', mpesaRouter);

// Connect WhatsApp routes
const whatsappRouter = require('./routes/whatsapp');
app.use('/whatsapp', whatsappRouter);

// A test route — just to confirm the server is running
app.get('/', (req, res) => {
    res.json({ message: 'Hotel backend is running!' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});