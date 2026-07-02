const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabase');
const { sendOrderNotification } = require('../services/firebase');
const { sendPaymentConfirmation } = require('../services/twilio');
const { getSession, clearSession, toWhatsAppPhone } = require('../services/whatsappSession');

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

async function createOrderFromSession(whatsappPhone, formattedPhone) {
    const { data: session } = await getSession(whatsappPhone);

    if (!session?.food_item || !session?.room_number) {
        console.error('No active whatsapp session found for payment:', whatsappPhone);
        return null;
    }

    const localPhone = '0' + formattedPhone.slice(3);

    const { data: order, error } = await supabase
        .from('orders')
        .insert([{
            food_item: session.food_item,
            room_number: session.room_number,
            phone: localPhone,
            channel: 'whatsapp',
            status: 'paid',
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating order from whatsapp session:', error);
        return null;
    }

    await clearSession(whatsappPhone);
    console.log(`✅ Order ${order.id} created after M-Pesa payment`, order);
    return order;
}

router.post('/stk-push', async (req, res) => {
    try {
        const { phone, amount, order_id } = req.body;

        console.log('STK Push Request:', { phone, amount, order_id });

        const formattedPhone = '254' + phone.slice(1);
        console.log('Formatted phone:', formattedPhone);

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
            AccountReference: order_id ? `Order${order_id}` : formattedPhone,
            TransactionDesc: 'TJ Resturant',
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
            error: error.response?.data || error.message,
        });
    }
});

router.post('/callback', async (req, res) => {
    console.log('=== M-Pesa Callback Received ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));

    try {
        const body = req.body.Body.stkCallback;
        const resultCode = body.ResultCode;

        console.log('Result Code:', resultCode);
        console.log('Result Description:', body.ResultDesc);

        if (resultCode === 0) {
            const metadata = body.CallbackMetadata.Item;
            console.log('Payment metadata:', metadata);

            const accountRef = metadata.find(i => i.Name === 'AccountReference')?.Value;
            console.log('Account reference:', accountRef);

            let order = null;

            if (accountRef?.startsWith('Order')) {
                const orderId = accountRef.replace('Order', '');

                const { data, error } = await supabase
                    .from('orders')
                    .update({ status: 'paid' })
                    .eq('id', orderId)
                    .select()
                    .single();

                if (error) {
                    console.error('Supabase update error:', error);
                } else {
                    order = data;
                    console.log(`✅ Order ${orderId} marked as paid`, data);
                }
            } else if (/^254\d{9}$/.test(accountRef)) {
                const whatsappPhone = toWhatsAppPhone(accountRef);
                order = await createOrderFromSession(whatsappPhone, accountRef);
            } else {
                console.error('Unrecognized account reference:', accountRef);
            }

            if (order) {
                await sendOrderNotification(order);

                try {
                    await sendPaymentConfirmation(order);
                    console.log('WhatsApp payment confirmation sent');
                } catch (whatsappError) {
                    console.error('WhatsApp notification failed:', whatsappError.message);
                }
            }
        } else {
            console.log('❌ Payment failed or cancelled:', body.ResultDesc);
        }
    } catch (error) {
        console.error('Error processing callback:', error);
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
});

module.exports = router;
