const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const supabase = require('../supabase');
const axios = require('axios');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const MENU = [
    { id: 1, name: 'Chicken Burger', price: 450 },
    { id: 2, name: 'Club Sandwich', price: 380 },
    { id: 3, name: 'Beef Stew + Rice', price: 520 },
    { id: 4, name: 'Pasta Carbonara', price: 600 },
    { id: 5, name: 'Vegetable Salad', price: 280 },
    { id: 6, name: 'Fresh Juice', price: 180 },
];

async function sendMessage(to, message) {
    try {
        await client.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: to,
            body: message,
        });
        console.log('WhatsApp message sent to:', to);
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.message);
    }
}

// Test endpoint - verify webhook is working
router.get('/test', (req, res) => {
    res.json({
        status: 'WhatsApp webhook is working!',
        timestamp: new Date().toISOString(),
        twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    });
});

router.post('/incoming', async (req, res) => {
    console.log('=== WhatsApp Webhook Received ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const from = req.body.From;         // e.g. "whatsapp:+254712345678"
    const body = req.body.Body?.trim(); // what the customer typed

    console.log('From:', from, '- Message:', body);

    // Validate input
    if (!from || !body) {
        console.error('❌ Missing From or Body in request');
        return res.sendStatus(400);
    }

    try {
        // Get or create conversation state
        let { data: convo } = await supabase
            .from('conversations')
            .select('*')
            .eq('phone', from)
            .single();

        // --- STEP: No conversation yet or customer types "hi/hello/order" ---
        if (!convo || ['hi', 'hello', 'order', 'start', 'menu'].includes(body.toLowerCase())) {
            const menuText = MENU.map(item =>
                `${item.id}. ${item.name} — KES ${item.price}`
            ).join('\n');

            await sendMessage(from, `Welcome to TJ Restaurant! 🍽️\n\nOur menu:\n${menuText}\n\nReply with the *number* of what you'd like to order.`);

            await supabase.from('conversations').upsert({
                phone: from,
                step: 'menu_shown',
                food_item: null,
                price: null,
                room_number: null,
            });

            return res.sendStatus(200);
        }

        // --- STEP: Customer just saw the menu, expects a menu number ---
        if (convo.step === 'menu_shown') {
            const choice = parseInt(body);
            const selectedItem = MENU.find(item => item.id === choice);

            if (!selectedItem) {
                await sendMessage(from, 'Please reply with a number from the menu (1–6).');
                return res.sendStatus(200);
            }

            await sendMessage(from, `Great choice! *${selectedItem.name}* — KES ${selectedItem.price}\n\nPlease type your *room number*:`);

            await supabase.from('conversations').upsert({
                phone: from,
                step: 'room_asked',
                food_item: selectedItem.name,
                price: selectedItem.price,
                room_number: null,
            });

            return res.sendStatus(200);
        }

        // --- STEP: Customer just gave room number ---
        if (convo.step === 'room_asked') {
            const roomNumber = body;

            await sendMessage(
                from,
                `Got it! Here's your order summary:\n\n📦 *${convo.food_item}*\n🚪 Room: *${roomNumber}*\n💰 KES ${convo.price}\n\nType *YES* to confirm and pay, or *NO* to cancel.`
            );

            await supabase.from('conversations').upsert({
                phone: from,
                step: 'confirming',
                food_item: convo.food_item,
                price: convo.price,
                room_number: roomNumber,
            });

            return res.sendStatus(200);
        }

        // --- STEP: Customer confirming ---
        if (convo.step === 'confirming') {
            if (body.toLowerCase() === 'yes') {
                // Extract phone number from WhatsApp format
                const phone = from.replace('whatsapp:+254', '0');

                // Create order in database
                const { data: order, error } = await supabase
                    .from('orders')
                    .insert([{
                        food_item: convo.food_item,
                        room_number: convo.room_number,
                        phone: phone,
                        channel: 'whatsapp',
                        status: 'pending_payment',
                    }])
                    .select()
                    .single();

                if (error) {
                    console.error('Error creating order:', error);
                    await sendMessage(from, 'Sorry, there was an error creating your order. Please try again or call the front desk.');
                    return res.sendStatus(200);
                }

                // Trigger STK push
                try {
                    await axios.post(`${process.env.BACKEND_URL}/mpesa/stk-push`, {
                        phone: phone,
                        amount: convo.price,
                        order_id: order.id,
                    });

                    await sendMessage(from, `✅ Order placed! Check your phone for an M-Pesa payment prompt of KES ${convo.price}. Enter your PIN to complete payment.\n\nOrder ID: #${order.id}`);
                } catch (mpesaError) {
                    console.error('M-Pesa STK Push error:', mpesaError.message);
                    await sendMessage(from, `Order created (ID: #${order.id}), but there was an issue with the payment prompt. Please contact the front desk.`);
                }

                // Clear conversation state
                await supabase.from('conversations').delete().eq('phone', from);

            } else if (body.toLowerCase() === 'no') {
                await sendMessage(from, 'Order cancelled. Type *hi* to start a new order anytime. 😊');
                await supabase.from('conversations').delete().eq('phone', from);
            } else {
                await sendMessage(from, 'Please reply with *YES* to confirm or *NO* to cancel.');
            }

            return res.sendStatus(200);
        }

        // Default fallback
        await sendMessage(from, 'Type *hi* to start ordering. 🍽️');
        res.sendStatus(200);

    } catch (error) {
        console.error('WhatsApp webhook error:', error);
        res.sendStatus(500);
    }
});

// Optional: Status callback endpoint
router.post('/status', (req, res) => {
    console.log('Message status:', req.body.MessageStatus);
    res.sendStatus(200);
});

module.exports = router;
