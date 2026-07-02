const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabase');
const { sendOrderNotification } = require('../services/firebase');
const { sendPaymentConfirmation } = require('../services/twilio');

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
    try {
        const { phone, amount, order_id } = req.body;

        console.log('STK Push Request:', { phone, amount, order_id });

        // Format phone: remove leading 0, add 254
        const formattedPhone = '254' + phone.slice(1);
        console.log('Formatted phone:', formattedPhone);

        const token = await getAccessToken();
        console.log('Access token obtained');

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

        console.log('Sending STK Push to M-Pesa...');
        console.log('Callback URL:', process.env.MPESA_CALLBACK_URL);

        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log('M-Pesa STK Response:', response.data);

        res.json(response.data);
    } catch (error) {
        console.error('STK Push Error:', error.response?.data || error.message);
        res.status(500).json({
            error: error.response?.data || error.message
        });
    }
});

// Step 3: Receive M-Pesa payment result (callback webhook)
router.post('/callback', async (req, res) => {
    console.log('=== M-Pesa Callback Received ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));

    try {
        const body = req.body.Body.stkCallback;
        const resultCode = body.ResultCode;

        console.log('Result Code:', resultCode);
        console.log('Result Description:', body.ResultDesc);

        // ResultCode 0 means payment was successful
        if (resultCode === 0) {
            const metadata = body.CallbackMetadata.Item;

            console.log('Payment metadata:', metadata);

            // Extract order ID from AccountReference
            const accountRef = metadata.find(i => i.Name === 'AccountReference')?.Value;
            const orderId = accountRef?.replace('Order', '');

            console.log('Extracted order ID:', orderId);

            // Update order status to paid
            const { data, error } = await supabase
                .from('orders')
                .update({ status: 'paid' })
                .eq('id', orderId)
                .select()
                .single();

            if (error) {
                console.error('Supabase update error:', error);
            } else {
                console.log(`✅ Order ${orderId} marked as paid`, data);

                // Send push notification to admin
                if (data) {
                    await sendOrderNotification(data);

                    // Send WhatsApp payment confirmation to customer
                    try {
                        await sendPaymentConfirmation(data);
                        console.log('WhatsApp payment confirmation sent');
                    } catch (whatsappError) {
                        console.error('WhatsApp notification failed:', whatsappError.message);
                    }
                }
            }
        } else {
            console.log('❌ Payment failed or cancelled:', body.ResultDesc);
        }
    } catch (error) {
        console.error('Error processing callback:', error);
    }

    // Always respond 200 to M-Pesa — they need this acknowledgement
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
});

module.exports = router;
