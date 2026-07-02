const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const axios = require('axios');
const { getSession, saveSession, clearSession, toLocalPhone } = require('../services/whatsappSession');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const BACKEND_URL = process.env.BACKEND_URL || 'https://tj-resturant.onrender.com';

const MENU = [
    { id: 1, name: 'Chicken Burger', price: 450 },
    { id: 2, name: 'Club Sandwich', price: 380 },
    { id: 3, name: 'Beef Stew + Rice', price: 520 },
    { id: 4, name: 'Pasta Carbonara', price: 600 },
    { id: 5, name: 'Vegetable Salad', price: 280 },
    { id: 6, name: 'Fresh Juice', price: 180 },
];

const START_KEYWORDS = ['hi', 'hello', 'order', 'menu', 'start'];

async function sendMessage(to, message) {
    await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to,
        body: message,
    });
}

function buildMenuText() {
    return MENU.map(item => `${item.id}. ${item.name} — KES ${item.price}`).join('\n');
}

router.post('/incoming', async (req, res) => {
    res.sendStatus(200);

    const from = req.body.From;
    const body = req.body.Body?.trim();

    if (!from || !body) return;

    console.log(`Incoming from ${from}: "${body}"`);

    try {
        const { data: session, error: sessionError } = await getSession(from);

        if (sessionError) {
            await sendMessage(from,
                '⚠️ Our ordering system is temporarily unavailable. Please try again in a moment.'
            );
            return;
        }

        const step = session?.step || 'start';
        const normalised = body.toLowerCase();

        if (START_KEYWORDS.includes(normalised) || !session) {
            await sendMessage(from,
                `👋 Welcome to Hotel Room Service!\n\nHere is our menu:\n\n${buildMenuText()}\n\nReply with the *number* of the item you want to order.`
            );

            const { error: saveError } = await saveSession(from, {
                step: 'menu_shown',
                food_item: null,
                price: null,
                room_number: null,
            });

            if (saveError) {
                console.error('Failed to persist menu_shown session for', from);
            }
            return;
        }

        if (step === 'menu_shown') {
            const choice = parseInt(body, 10);
            const selectedItem = MENU.find(item => item.id === choice);

            if (!selectedItem) {
                await sendMessage(from,
                    `❌ Please reply with a number between 1 and ${MENU.length}.\n\nFor example, type *1* for Chicken Burger.`
                );
                return;
            }

            await sendMessage(from,
                `✅ You selected: *${selectedItem.name}* — KES ${selectedItem.price}\n\nWhat is your *room number*? (e.g. 204)`
            );

            await saveSession(from, {
                step: 'room_asked',
                food_item: selectedItem.name,
                price: selectedItem.price,
                room_number: null,
            });
            return;
        }

        if (step === 'room_asked') {
            const roomNumber = body.trim();

            if (!roomNumber) {
                await sendMessage(from, 'Please enter your room number (e.g. 204).');
                return;
            }

            const phone = toLocalPhone(from);

            await saveSession(from, {
                step: 'awaiting_payment',
                food_item: session.food_item,
                price: session.price,
                room_number: roomNumber,
            });

            try {
                await axios.post(`${BACKEND_URL}/mpesa/stk-push`, {
                    phone,
                    amount: session.price,
                });

                await sendMessage(from,
                    `📋 *Order Summary*\n\n🍽️ Item: *${session.food_item}*\n🚪 Room: *${roomNumber}*\n💰 Total: *KES ${session.price}*\n\n💳 *Payment prompt sent!*\n\nCheck your phone for an M-Pesa request of *KES ${session.price}*. Enter your M-Pesa PIN to complete your order.\n\nYour food will be delivered to Room *${roomNumber}* once payment is confirmed. 🚀`
                );
            } catch (mpesaError) {
                console.error('STK push error:', mpesaError.response?.data || mpesaError.message);
                await sendMessage(from,
                    '⚠️ We could not send the payment prompt. Please type *hi* to try again.'
                );
                await clearSession(from);
            }
            return;
        }

        if (step === 'awaiting_payment') {
            await sendMessage(from,
                `⏳ Waiting for your M-Pesa payment of *KES ${session.price}* for *${session.food_item}*.\n\nComplete the prompt on your phone, or type *hi* to start a new order.`
            );
            return;
        }

        await sendMessage(from, 'Type *hi* to start ordering. 😊');
        await clearSession(from);
    } catch (err) {
        console.error('Webhook error:', err);
        try {
            await sendMessage(from, '⚠️ Something went wrong on our end. Please type *hi* to try again.');
        } catch (_) { }
    }
});

module.exports = router;
