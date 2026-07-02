const express = require('express');
const router = express.Router();

// Hardcoded menu for now — you can move this to the database later
const MENU = [
    { id: 1, name: 'Chicken Burger', price: 450 },
    { id: 2, name: 'Club Sandwich', price: 380 },
    { id: 3, name: 'Beef Stew + Rice', price: 520 },
    { id: 4, name: 'Pasta Carbonara', price: 600 },
    { id: 5, name: 'Vegetable Salad', price: 280 },
    { id: 6, name: 'Fresh Juice', price: 180 },
];

router.get('/', (req, res) => {
    res.json(MENU);
});

module.exports = router;
