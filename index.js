const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware — these two lines let Express read JSON from requests
app.use(express.json());
app.use(cors());

// Connect orders routes
const ordersRouter = require('./routes/orders');
app.use('/orders', ordersRouter);

// Connect menu routes
const menuRouter = require('./routes/menu');
app.use('/menu', menuRouter);

// A test route — just to confirm the server is running
app.get('/', (req, res) => {
    res.json({ message: 'Hotel backend is running!' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});