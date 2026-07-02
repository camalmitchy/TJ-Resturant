const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET all orders (Flutter app calls this to load the dashboard)
router.get('/', async (req, res) => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST create a new order
router.post('/', async (req, res) => {
    const { food_item, room_number, phone, channel } = req.body;

    const { data, error } = await supabase
        .from('orders')
        .insert([{ food_item, room_number, phone, channel, status: 'pending_payment' }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// PATCH update order status (e.g. mark as delivered)
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

module.exports = router;
