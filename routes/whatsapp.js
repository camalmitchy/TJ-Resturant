const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const supabase = require('../supabase');
const axios = require('axios');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ─── MENU ────────────────────────────────────────────────────────────────────
const MENU = [
    { id: 1, name: 'Chicken Burger', price: 450 },
    { id: 2, name: 'Club Sandwich', price: 380 },
    { id: 3, name: 'Beef Stew + Rice', price: 520 },
    { id: 4, name: 'Pasta Carbonara', price: 600 },
    { id: 5, name: 'Vegetable Salad', price: 280 },
    { id: 6, name: 'Fresh Juice', price: 180 },
];

// ─── HELPER: send a WhatsApp message via Twilio ───────────────────────────────
async function sendMessage(to, message) {
    await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER, // e.g. whatsapp:+14155238886
        to: to,
        body: message,
    });
}

// ─── HELPER: get conversation state from DB ───────────────────────────────────
// Uses maybeSingle() — returns null safely when no row exists (first-time customer)
// .single() was the bug — it throws an error on no result and crashes the whole webhook
async function getConversation(phone) {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('phone', phone)
        .maybeSingle(); // ← CRITICAL FIX: won't crash when customer is new

    if (error) {
        console.error('Error fetching conversation:', error.message);
        return null;
    }
    return data; // null if no conversation, object if found
}

// ─── HELPER: save/update conversation state ───────────────────────────────────
async function saveConversation(phone, updates) {
    const { error } = await supabase
        .from('conversations')
        .upsert(
            { phone, ...updates },
            { onConflict: 'phone' } // ← CRITICAL FIX: tells Supabase to UPDATE if phone exists
        );

    if (error) {
        console.error('Error saving conversation:', error.message);
    }
}

// ─── HELPER: clear conversation after order is placed or cancelled ────────────
async function clearConversation(phone) {
    const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('phone', phone);

    if (error) {
        console.error('Error clearing conversation:', error.message);
    }
}

// ─── MAIN WEBHOOK ─────────────────────────────────────────────────────────────
// Twilio calls this URL every time a customer sends your WhatsApp number a message
router.post('/incoming', async (req, res) => {
    // Always respond 200 to Twilio immediately — it expects this fast acknowledgement
    // If you don't, Twilio retries the webhook multiple times
    res.sendStatus(200);

    const from = req.body.From;          // e.g. "whatsapp:+254712345678"
    const body = req.body.Body?.trim();  // what the customer typed

    if (!from || !body) return;

    console.log(`Incoming from ${from}: "${body}"`);

    try {
        // Get this customer's current conversation state
        const convo = await getConversation(from);
        const step = convo?.step;
        const normalised = body.toLowerCase();

        // ── RESET TRIGGER: customer types hi/hello/order/menu at any point ──────
        if (!step || ['hi', 'hello', 'order', 'menu', 'start'].includes(normalised)) {
            const menuText = MENU.map(item =>
                `${item.id}. ${item.name} — KES ${item.price}`
            ).join('\n');

            await sendMessage(from,
                `👋 Welcome to Hotel Room Service!\n\nHere is our menu:\n\n${menuText}\n\nReply with the *number* of the item you want to order.`
            );

            await saveConversation(from, {
                step: 'menu_shown',
                food_item: null,
                price: null,
                room_number: null,
            });
            return;
        }

        // ── STEP: menu_shown → customer should reply with a menu number ──────────
        if (step === 'menu_shown') {
            const choice = parseInt(body);
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

            await saveConversation(from, {
                step: 'room_asked',
                food_item: selectedItem.name,
                price: selectedItem.price,
                room_number: null,
            });
            return;
        }

        // ── STEP: room_asked → customer should type their room number ────────────
        if (step === 'room_asked') {
            const roomNumber = body;

            // Basic validation — room number should not be empty or just spaces
            if (!roomNumber || roomNumber.length < 1) {
                await sendMessage(from, 'Please enter your room number (e.g. 204).');
                return;
            }

            await sendMessage(from,
                `📋 *Order Summary*\n\n🍽️ Item: *${convo.food_item}*\n🚪 Room: *${roomNumber}*\n💰 Total: *KES ${convo.price}*\n\nReply *YES* to confirm and pay, or *NO* to cancel.`
            );

            // Save room number to conversation state
            await saveConversation(from, {
                step: 'confirming',
                food_item: convo.food_item,
                price: convo.price,
                room_number: roomNumber,   // ← CRITICAL FIX: was missing from table before
            });
            return;
        }

        // ── STEP: confirming → customer says YES or NO ───────────────────────────
        if (step === 'confirming') {
            if (normalised === 'yes') {
                // Convert WhatsApp number format to local Kenyan format
                // from = "whatsapp:+254712345678" → "0712345678"
                const phone = '0' + from.replace('whatsapp:+254', '');

                // 1. Create order in database
                const { data: order, error: orderError } = await supabase
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

                if (orderError) {
                    console.error('Error creating order:', orderError.message);
                    await sendMessage(from, '⚠️ Something went wrong creating your order. Please try again by typing *hi*.');
                    await clearConversation(from);
                    return;
                }

                console.log(`Order created: ID ${order.id}`);

                // 2. Trigger M-Pesa STK push
                try {
                    await axios.post(`${process.env.BACKEND_URL}/mpesa/stk-push`, {
                        phone: phone,
                        amount: convo.price,
                        order_id: order.id,
                    });

                    await sendMessage(from,
                        `💳 *Payment prompt sent!*\n\nCheck your phone for an M-Pesa request of *KES ${convo.price}*.\n\nEnter your M-Pesa PIN to complete your order. Your food will be delivered to Room *${convo.room_number}* once payment is confirmed. 🚀`
                    );
                } catch (mpesaError) {
                    console.error('STK push error:', mpesaError.message);
                    // Order is created but payment prompt failed — let customer know
                    await sendMessage(from,
                        `✅ Order placed (ID: ${order.id}) but the payment prompt failed to send. Please call us to complete payment for Room ${convo.room_number}.`
                    );
                }

                // 3. Clear conversation — this order flow is done
                await clearConversation(from);

            } else if (normalised === 'no') {
                await sendMessage(from,
                    '❌ Order cancelled. Type *hi* anytime to start a new order.'
                );
                await clearConversation(from);

            } else {
                // Customer typed something other than yes or no
                await sendMessage(from,
                    `Please reply *YES* to confirm your order or *NO* to cancel.\n\n🍽️ ${convo.food_item} — KES ${convo.price} → Room ${convo.room_number}`
                );
            }
            return;
        }

        // ── FALLBACK: unknown state ───────────────────────────────────────────────
        await sendMessage(from, 'Type *hi* to start ordering. 😊');
        await clearConversation(from); // reset any broken state

    } catch (err) {
        console.error('Webhook error:', err);
        // Try to send a fallback message to the customer
        try {
            await sendMessage(from, '⚠️ Something went wrong on our end. Please type *hi* to try again.');
        } catch (_) { }
    }
});

module.exports = router;
