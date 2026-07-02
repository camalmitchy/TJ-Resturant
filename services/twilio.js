const twilio = require('twilio');

// Initialize Twilio client
let twilioClient = null;

function initializeTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        console.warn('⚠️  Twilio credentials not found. WhatsApp messaging disabled.');
        return false;
    }

    try {
        twilioClient = twilio(accountSid, authToken);
        console.log('✅ Twilio initialized');
        return true;
    } catch (error) {
        console.error('❌ Twilio initialization error:', error.message);
        return false;
    }
}

// Send WhatsApp message
async function sendWhatsAppMessage(to, message) {
    if (!twilioClient) {
        console.log('Twilio not initialized, skipping WhatsApp message');
        return { success: false, error: 'Twilio not initialized' };
    }

    try {
        // Format phone number for WhatsApp
        // If it starts with 0, replace with country code (254 for Kenya)
        let formattedPhone = to;
        if (to.startsWith('0')) {
            formattedPhone = '254' + to.slice(1);
        }
        // Add whatsapp: prefix
        const whatsappNumber = `whatsapp:+${formattedPhone}`;

        const response = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: whatsappNumber
        });

        console.log('✅ WhatsApp message sent:', response.sid);
        return { success: true, messageId: response.sid };
    } catch (error) {
        console.error('❌ Error sending WhatsApp message:', error.message);
        return { success: false, error: error.message };
    }
}

// Send order confirmation via WhatsApp
async function sendOrderConfirmation(orderData) {
    const message = `
🍽️ *Order Confirmation - TJ Restaurant*

Thank you for your order!

📋 *Order Details:*
- Food Item: ${orderData.food_item}
- Room Number: ${orderData.room_number}
- Order ID: #${orderData.id}

💳 *Payment:*
An M-Pesa STK push has been sent to your phone.
Please enter your PIN to complete payment.

⏱️ Your order will be prepared once payment is confirmed.

For assistance, call the front desk.

Thank you! 🙏
    `.trim();

    return await sendWhatsAppMessage(orderData.phone, message);
}

function formatReceiptDate(transactionDate) {
    if (!transactionDate) {
        return new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
    }

    const raw = String(transactionDate);
    const year = raw.slice(0, 4);
    const month = raw.slice(4, 6);
    const day = raw.slice(6, 8);
    const hour = raw.slice(8, 10);
    const minute = raw.slice(10, 12);

    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
    return date.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
}

// Send payment receipt via WhatsApp after successful M-Pesa payment
async function sendPaymentConfirmation(orderData, paymentDetails = {}) {
    const amount = paymentDetails.amount ?? orderData.amount;
    const amountLine = amount ? `\nAmount:   *KSh ${amount}*` : '';
    const receiptLine = paymentDetails.mpesaReceipt
        ? `\nM-Pesa:   *${paymentDetails.mpesaReceipt}*`
        : '';
    const dateLine = `\nDate:     ${formatReceiptDate(paymentDetails.transactionDate)}`;

    const message = `
🧾 *Payment Receipt - TJ Restaurant*

✅ *Payment received successfully!*

📋 *Order #${orderData.id}*
━━━━━━━━━━━━━━━━
Item:     *${orderData.food_item}*
Room:     *${orderData.room_number}*${amountLine}${receiptLine}${dateLine}
━━━━━━━━━━━━━━━━

🚀 Your order will be delivered to Room *${orderData.room_number}* in a few minutes.

Thank you for your order! 🙏
    `.trim();

    return await sendWhatsAppMessage(orderData.phone, message);
}

// Send delivery notification via WhatsApp
async function sendDeliveryNotification(orderData) {
    const message = `
🚪 *Order Delivered - TJ Restaurant*

Your order has been delivered!

📋 *Order Details:*
- Food Item: ${orderData.food_item}
- Room Number: ${orderData.room_number}
- Order ID: #${orderData.id}

Enjoy your meal! 😊

Rate your experience:
👍 Good | 👎 Needs Improvement

Thank you for choosing TJ Restaurant! 🙏
    `.trim();

    return await sendWhatsAppMessage(orderData.phone, message);
}

module.exports = {
    initializeTwilio,
    sendWhatsAppMessage,
    sendOrderConfirmation,
    sendPaymentConfirmation,
    sendDeliveryNotification,
};
