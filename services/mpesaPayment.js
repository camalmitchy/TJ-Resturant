const axios = require('axios');
const supabase = require('../supabase');
const { sendOrderNotification } = require('./firebase');
const { sendPaymentConfirmation } = require('./twilio');
const { getSession, clearSession, toWhatsAppPhone } = require('./whatsappSession');

const MERCHANT_NAME = 'TJ Resturant';
const STK_PUSH_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
const STK_QUERY_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';
const OAUTH_URL = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildMpesaPassword() {
    const timestamp = new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, 14);

    const password = Buffer.from(
        `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    return { timestamp, password };
}

async function getAccessToken() {
    const auth = Buffer.from(
        `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await axios.get(OAUTH_URL, {
        headers: { Authorization: `Basic ${auth}` },
    });

    return response.data.access_token;
}

function extractPaymentDetails(metadataItems) {
    if (!Array.isArray(metadataItems)) {
        return {};
    }

    const getMeta = (name) => metadataItems.find((item) => item.Name === name)?.Value;

    return {
        amount: getMeta('Amount'),
        mpesaReceipt: getMeta('MpesaReceiptNumber'),
        transactionDate: getMeta('TransactionDate'),
    };
}

function isMerchantReference(accountRef) {
    if (!accountRef) return false;

    const normalized = String(accountRef).replace(/\s+/g, ' ').trim();
    return normalized === MERCHANT_NAME || normalized.replace(/\s/g, '') === 'TJResturant';
}

async function attachCheckoutRequestId(orderId, checkoutRequestId) {
    const { error } = await supabase
        .from('orders')
        .update({ checkout_request_id: checkoutRequestId })
        .eq('id', orderId);

    if (error) {
        console.error('Failed to store checkout_request_id:', error.message);
    }
}

async function findPendingOrderByPhone(formattedPhone) {
    const localPhone = '0' + formattedPhone.slice(3);

    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('phone', localPhone)
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error finding pending order by phone:', error.message);
        return null;
    }

    return data;
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
        console.error('Error creating order from whatsapp session:', error.message);
        return null;
    }

    await clearSession(whatsappPhone);
    console.log(`✅ Order ${order.id} created after M-Pesa payment`, order);
    return order;
}

async function finalizeOrderPayment({ orderId, checkoutRequestId, paymentDetails = {}, source = 'callback' }) {
    let order = null;

    if (orderId) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();

        if (error) {
            console.error('Error loading order by id:', error.message);
            return null;
        }
        order = data;
    } else if (checkoutRequestId) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('checkout_request_id', checkoutRequestId)
            .maybeSingle();

        if (error) {
            console.error('Error loading order by checkout_request_id:', error.message);
            return null;
        }
        order = data;
    }

    if (!order) {
        return null;
    }

    if (order.status === 'paid') {
        console.log(`Order ${order.id} already paid (${source})`);
        return order;
    }

    const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', order.id)
        .eq('status', 'pending_payment')
        .select()
        .maybeSingle();

    if (updateError) {
        console.error('Error marking order as paid:', updateError.message);
        return null;
    }

    if (!updated) {
        const { data: existing } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order.id)
            .maybeSingle();

        if (existing?.status === 'paid') {
            return existing;
        }

        console.error(`Could not finalize order ${order.id} (${source})`);
        return null;
    }

    if (updated.channel === 'whatsapp') {
        const formattedPhone = updated.phone.startsWith('0')
            ? '254' + updated.phone.slice(1)
            : updated.phone.replace(/\D/g, '');
        await clearSession(toWhatsAppPhone(formattedPhone));
    }

    try {
        await sendOrderNotification(updated);
    } catch (notificationError) {
        console.error('Admin notification failed:', notificationError.message);
    }

    const receiptResult = await sendPaymentConfirmation(updated, paymentDetails);
    if (receiptResult.success) {
        console.log(`WhatsApp payment receipt sent for order ${updated.id} (${source})`);
    } else {
        console.error('WhatsApp payment receipt failed:', receiptResult.error);
    }

    console.log(`✅ Order ${updated.id} marked as paid via ${source}`);
    return updated;
}

async function queryStkPushStatus(checkoutRequestId) {
    const token = await getAccessToken();
    const { timestamp, password } = buildMpesaPassword();

    const response = await axios.post(
        STK_QUERY_URL,
        {
            BusinessShortCode: process.env.MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
}

async function pollStkPayment(checkoutRequestId, orderId) {
    console.log(`Polling M-Pesa payment status for order ${orderId}...`);

    await sleep(3000);

    for (let attempt = 1; attempt <= 20; attempt += 1) {
        try {
            const result = await queryStkPushStatus(checkoutRequestId);
            const resultCode = String(result.ResultCode ?? '');

            console.log(`STK poll attempt ${attempt} for order ${orderId}:`, resultCode, result.ResultDesc);

            if (resultCode === '0') {
                const paymentDetails = extractPaymentDetails(result.CallbackMetadata?.Item);
                await finalizeOrderPayment({
                    orderId,
                    paymentDetails,
                    source: 'poll',
                });
                return;
            }

            if (resultCode !== '4999') {
                console.log(`STK poll stopped for order ${orderId}:`, result.ResultDesc);
                return;
            }
        } catch (error) {
            console.error(`STK poll attempt ${attempt} failed for order ${orderId}:`, error.response?.data || error.message);
        }

        await sleep(3000);
    }

    console.log(`STK poll timed out for order ${orderId}; waiting for M-Pesa callback`);
}

async function sendStkPush({ phone, amount, orderId }) {
    const formattedPhone = '254' + phone.slice(1);
    const token = await getAccessToken();
    const { timestamp, password } = buildMpesaPassword();

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
        AccountReference: MERCHANT_NAME,
        TransactionDesc: MERCHANT_NAME,
    };

    const response = await axios.post(STK_PUSH_URL, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });

    const checkoutRequestId = response.data?.CheckoutRequestID;

    if (checkoutRequestId && orderId) {
        await attachCheckoutRequestId(orderId, checkoutRequestId);
        pollStkPayment(checkoutRequestId, orderId).catch((error) => {
            console.error(`Background STK poll failed for order ${orderId}:`, error.message);
        });
    }

    return response.data;
}

async function processMpesaCallback(stkCallback) {
    const resultCode = stkCallback.ResultCode;

    if (resultCode !== 0) {
        console.log('Payment failed or cancelled:', stkCallback.ResultDesc);
        return null;
    }

    const metadata = stkCallback.CallbackMetadata?.Item;
    const paymentDetails = extractPaymentDetails(metadata);
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const accountRef = metadata?.find((item) => item.Name === 'AccountReference')?.Value;
    const phoneFromMeta = metadata?.find((item) => item.Name === 'PhoneNumber')?.Value;

    let order = null;

    if (checkoutRequestId) {
        order = await finalizeOrderPayment({
            checkoutRequestId,
            paymentDetails,
            source: 'callback',
        });
    }

    if (!order && accountRef?.startsWith('Order')) {
        const legacyOrderId = accountRef.replace('Order', '');
        order = await finalizeOrderPayment({
            orderId: legacyOrderId,
            paymentDetails,
            source: 'callback-legacy',
        });
    }

    if (!order && /^254\d{9}$/.test(accountRef)) {
        const whatsappPhone = toWhatsAppPhone(accountRef);
        order = await createOrderFromSession(whatsappPhone, accountRef);

        if (order) {
            try {
                await sendOrderNotification(order);
            } catch (notificationError) {
                console.error('Admin notification failed:', notificationError.message);
            }

            const receiptResult = await sendPaymentConfirmation(order, paymentDetails);
            if (!receiptResult.success) {
                console.error('WhatsApp payment receipt failed:', receiptResult.error);
            }
        }
    }

    if (!order && isMerchantReference(accountRef) && phoneFromMeta) {
        const pendingOrder = await findPendingOrderByPhone(phoneFromMeta);

        if (pendingOrder) {
            order = await finalizeOrderPayment({
                orderId: pendingOrder.id,
                paymentDetails,
                source: 'callback-phone',
            });
        } else {
            const whatsappPhone = toWhatsAppPhone(phoneFromMeta);
            const { data: session } = await getSession(whatsappPhone);

            if (session?.step === 'awaiting_payment') {
                order = await createOrderFromSession(whatsappPhone, phoneFromMeta);

                if (order) {
                    try {
                        await sendOrderNotification(order);
                    } catch (notificationError) {
                        console.error('Admin notification failed:', notificationError.message);
                    }

                    const receiptResult = await sendPaymentConfirmation(order, paymentDetails);
                    if (!receiptResult.success) {
                        console.error('WhatsApp payment receipt failed:', receiptResult.error);
                    }
                }
            }
        }
    }

    if (!order) {
        console.error('Payment received but no matching order found', {
            checkoutRequestId,
            accountRef,
            phoneFromMeta,
        });
    }

    return order;
}

module.exports = {
    MERCHANT_NAME,
    sendStkPush,
    processMpesaCallback,
    finalizeOrderPayment,
    pollStkPayment,
};
