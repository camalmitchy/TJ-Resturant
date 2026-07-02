const express = require('express');
const router = express.Router();
const { MENU, MENU_CATEGORIES } = require('../data/menu');

router.get('/', (req, res) => {
    res.json({ categories: MENU_CATEGORIES, items: MENU });
});

module.exports = router;
