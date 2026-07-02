const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabase');

// Step 1: Get an access token from Safaricom
async function getAccessToken() {
    const auth = Buffer.from(
        `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await axios.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        { headers: { Authorization: `Basic ${auth}` } }
    );

    return response.data.access_token;
}

// Step 2: Send STK Push to customer's phone
router.post('/stk-push', async (req, res) => {
    const { phone, amount, order_id } = req.body;

    // Format phone: remove leading 0, add 254
    const formattedPhone = '254' + phone.slice(1);

    const token = await getAccessToken();

    const timestamp = new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, 14);

    const password = Buffer.from(
        `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const payload = {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: formattedPhone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: `Order${order_id}`,
        TransactionDesc: 'Hotel Room Service Payment',
    };

    const response = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json(response.data);
});

// Step 3: Receive M-Pesa payment result (callback webhook)
router.post('/callback', async (req, res) => {
    const body = req.body.Body.stkCallback;
    const resultCode = body.ResultCode;

    // ResultCode 0 means payment was successful
    if (resultCode === 0) {
        const metadata = body.CallbackMetadata.Item;

        // Extract order ID from AccountReference
        const accountRef = metadata.find(i => i.Name === 'AccountReference')?.Value;
        const orderId = accountRef?.replace('Order', '');

        // Update order status to paid
        await supabase
            .from('orders')
            .update({ status: 'paid' })
            .eq('id', orderId);

        console.log(`Order ${orderId} marked as paid`);
    } else {
        console.log('Payment failed or cancelled:', body.ResultDesc);
    }

    // Always respond 200 to M-Pesa — they need this acknowledgement
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
});

module.exports = router;
