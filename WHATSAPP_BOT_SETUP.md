# WhatsApp Interactive Ordering Bot Setup

## Overview

Your backend now has a complete WhatsApp chatbot that allows customers to:
1. View the menu
2. Select items
3. Provide room number
4. Confirm order
5. Pay via M-Pesa STK Push
6. Receive order updates

All through WhatsApp conversations!

## How It Works

### Conversation Flow:

```
Customer: "Hi"
   ↓
Bot: Shows menu (1-6)
   ↓
Customer: "1" (selects Chicken Burger)
   ↓
Bot: "Great! What's your room number?"
   ↓
Customer: "204"
   ↓
Bot: Order summary + "Type YES to confirm"
   ↓
Customer: "YES"
   ↓
Bot: Creates order + Triggers M-Pesa STK Push
   ↓
Customer: Pays via M-Pesa
   ↓
Bot: Sends payment confirmation
   ↓
Admin: Prepares order
   ↓
Admin: Marks as delivered
   ↓
Bot: Sends delivery confirmation
```

## Setup Steps

### Step 1: Create Supabase Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create conversations table for WhatsApp bot state management
CREATE TABLE IF NOT EXISTS conversations (
  phone TEXT PRIMARY KEY,
  step TEXT NOT NULL,
  food_item TEXT,
  price INTEGER,
  room_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
```

Or use the file: `supabase_conversations_migration.sql`

### Step 2: Configure Twilio Webhook

1. Go to https://console.twilio.com
2. Navigate to: **Messaging** → **Settings** → **WhatsApp sandbox settings**
3. Set **When a message comes in:**
   ```
   https://tj-resturant.onrender.com/whatsapp/incoming
   ```
4. Method: `POST`
5. Click **Save**

### Step 3: Test the Bot

1. **Join WhatsApp Sandbox** (if not already):
   - Send message to sandbox number
   - Format: `join [your-code]`

2. **Start conversation:**
   ```
   You: hi
   ```

3. **Bot responds with menu:**
   ```
   Bot: Welcome to TJ Restaurant! 🍽️

   Our menu:
   1. Chicken Burger — KES 450
   2. Club Sandwich — KES 380
   3. Beef Stew + Rice — KES 520
   4. Pasta Carbonara — KES 600
   5. Vegetable Salad — KES 280
   6. Fresh Juice — KES 180

   Reply with the number of what you'd like to order.
   ```

4. **Select item:**
   ```
   You: 1
   ```

5. **Provide room:**
   ```
   You: 204
   ```

6. **Confirm:**
   ```
   You: YES
   ```

7. **Pay via M-Pesa:**
   - Check your phone for STK push
   - Enter PIN

8. **Receive confirmation**

## Conversation States

The bot tracks conversation state in the `conversations` table:

| Step | Description | Next Action |
|------|-------------|-------------|
| `menu_shown` | Menu displayed | Customer selects item number |
| `room_asked` | Item selected | Customer provides room number |
| `confirming` | Summary shown | Customer types YES/NO |
| (cleared) | Order placed | Conversation ends |

## Bot Commands

| Command | Action |
|---------|--------|
| `hi`, `hello`, `order`, `start`, `menu` | Show menu |
| `1-6` | Select menu item (when menu is shown) |
| Room number | Provide room number (when asked) |
| `YES` | Confirm order |
| `NO` | Cancel order |

## Features

### Smart Phone Number Formatting
Automatically converts WhatsApp format to Kenyan mobile:
- Input: `whatsapp:+254712345678`
- Output: `0712345678`

### Error Handling
- Invalid menu selection → Asks again
- Database errors → User-friendly message
- M-Pesa errors → Order created but payment issue noted
- All errors logged for debugging

### State Management
- Each customer tracked separately
- State cleared after order completion
- Auto-cleanup of old conversations (optional)

### Multi-Channel Integration
- Creates order in Supabase
- Triggers M-Pesa STK Push
- Sends admin push notification (when paid)
- Sends WhatsApp confirmations

## Testing Scenarios

### 1. Happy Path
```
You: hi
Bot: [menu]
You: 1
Bot: [room number?]
You: 204
Bot: [confirm?]
You: YES
Bot: [order placed]
```

### 2. Cancel Order
```
You: hi
Bot: [menu]
You: 2
Bot: [room number?]
You: 301
Bot: [confirm?]
You: NO
Bot: Order cancelled
```

### 3. Invalid Selection
```
You: hi
Bot: [menu]
You: 99
Bot: Please reply with a number 1-6
You: 3
Bot: [continues...]
```

### 4. Restart Mid-Conversation
```
You: hi
Bot: [menu]
You: 1
Bot: [room number?]
You: hi
Bot: [menu] (restarted)
```

## API Endpoints

### POST /whatsapp/incoming
**Purpose:** Receive messages from Twilio

**Request Body (from Twilio):**
```json
{
  "From": "whatsapp:+254712345678",
  "Body": "hi"
}
```

**Response:** 200 OK

### POST /whatsapp/status (Optional)
**Purpose:** Receive message delivery status

**Response:** 200 OK

## Environment Variables

Required in `.env` and Render:

```env
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
BACKEND_URL=https://tj-resturant.onrender.com
```

## Menu Configuration

To update the menu, edit `routes/whatsapp.js`:

```javascript
const MENU = [
  { id: 1, name: 'Chicken Burger', price: 450 },
  { id: 2, name: 'Club Sandwich', price: 380 },
  // Add more items...
];
```

Or later, fetch from database:
```javascript
const { data: MENU } = await supabase
  .from('menu_items')
  .select('*')
  .order('id');
```

## Troubleshooting

### Bot not responding
- Check Twilio webhook URL is correct
- Verify backend is deployed and running
- Check Render logs for errors
- Ensure WhatsApp sandbox is active

### State not persisting
- Verify `conversations` table exists in Supabase
- Check Supabase credentials in `.env`
- Look for database errors in logs

### M-Pesa not triggered
- Verify `BACKEND_URL` is set correctly
- Check M-Pesa credentials
- Look for axios errors in logs

### Messages not formatting correctly
- WhatsApp supports: *bold*, _italic_
- Emojis work normally
- Line breaks with `\n`

## Production Considerations

### Security
- Add Twilio webhook validation
- Rate limiting for abuse prevention
- Input sanitization

### Scalability
- Clean up old conversations (>24h)
- Add caching for menu
- Use message queues for high volume

### Features to Add
- Order history (`type "orders"`)
- Cancel order (`type "cancel"`)
- Change order (`type "modify"`)
- Track delivery status
- Multiple items per order
- Special instructions
- Delivery time estimates

## Webhook Validation (Optional)

Add security by validating Twilio signatures:

```javascript
const twilio = require('twilio');

router.post('/incoming', (req, res) => {
  const twilioSignature = req.headers['x-twilio-signature'];
  const url = `${process.env.BACKEND_URL}/whatsapp/incoming`;
  
  if (!twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    twilioSignature,
    url,
    req.body
  )) {
    return res.status(403).send('Forbidden');
  }
  
  // Process message...
});
```

## Cost

**Sandbox:** Free (testing)
**Production:** ~$0.005 per message

**Example:** 100 orders/day × 5 messages/order = 500 messages = $2.50/day

## Complete System

Your backend now supports **3 ordering channels**:

1. **Flutter Admin App** → Staff creates orders
2. **Phone Calls** → Staff takes order details
3. **WhatsApp Bot** → Customers order themselves ✨

All integrated with:
- ✅ Supabase database
- ✅ M-Pesa payments
- ✅ Push notifications (admin)
- ✅ WhatsApp confirmations (customers)

---

**Ready to test?** Configure the webhook and send "hi" to your bot! 🤖
