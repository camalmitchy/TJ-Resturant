const express = require('express');
const router = express.Router();
const { sendStkPush, processMpesaCallback } = require('../services/mpesaPayment');

router.post('/stk-push', async (req, res) => {
    try {
        const { phone, amount, order_id } = req.body;

        console.log('STK Push Request:', { phone, amount, order_id });

        const data = await sendStkPush({
            phone,
            amount,
            orderId: order_id,
        });

        console.log('M-Pesa STK Response:', data);
        res.json(data);
    } catch (error) {
        console.error('STK Push Error:', error.response?.data || error.message);
        res.status(500).json({
            error: error.response?.data || error.message,
        });
    }
});

router.post('/callback', (req, res) => {
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });

    console.log('=== M-Pesa Callback Received ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));

    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) {
        console.error('Invalid M-Pesa callback payload');
        return;
    }

    processMpesaCallback(stkCallback).catch((error) => {
        console.error('Error processing callback:', error);
    });
});

module.exports = router;
