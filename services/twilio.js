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

// Send payment confirmation via WhatsApp
async function sendPaymentConfirmation(orderData) {
    const message = `
✅ *Payment Confirmed - TJ Restaurant*

Payment received successfully!

📋 *Order Details:*
- Food Item: ${orderData.food_item}
- Room Number: ${orderData.room_number}
- Order ID: #${orderData.id}

👨‍🍳 Your order is now being prepared.
We'll deliver it to your room shortly.

Estimated time: 15-20 minutes

Enjoy your meal! 🍽️
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
