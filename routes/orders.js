const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabase');
const { sendOrderConfirmation, sendDeliveryNotification } = require('../services/twilio');

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
    const { food_item, room_number, phone, channel, amount } = req.body;

    const { data, error } = await supabase
        .from('orders')
        .insert([{ food_item, room_number, phone, channel, status: 'pending_payment' }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Send WhatsApp order confirmation
    if (channel === 'whatsapp' || channel === 'phone_call') {
        try {
            await sendOrderConfirmation(data);
            console.log('WhatsApp order confirmation sent');
        } catch (whatsappError) {
            console.error('WhatsApp notification failed:', whatsappError.message);
            // Don't fail the order creation if WhatsApp fails
        }
    }

    // Trigger STK push
    if (amount && phone) {
        try {
            const backendUrl = process.env.BACKEND_URL || 'https://tj-resturant.onrender.com';
            console.log('Triggering STK push to:', `${backendUrl}/mpesa/stk-push`);

            await axios.post(`${backendUrl}/mpesa/stk-push`, {
                phone: phone,
                amount: amount,
                order_id: data.id
            });

            console.log('STK push triggered successfully');
        } catch (mpesaError) {
            console.error('M-Pesa STK Push failed:', mpesaError.message);
            // Still return the order even if STK push fails
        }
    } else {
        console.log('Skipping STK push - amount or phone missing');
    }

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

    // Send WhatsApp notification when order is delivered
    if (status === 'delivered' && data) {
        try {
            await sendDeliveryNotification(data);
            console.log('WhatsApp delivery notification sent');
        } catch (whatsappError) {
            console.error('WhatsApp notification failed:', whatsappError.message);
        }
    }

    res.json(data);
});

module.exports = router;
