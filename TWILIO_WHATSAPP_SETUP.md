# Twilio WhatsApp Integration Setup

## Overview

Your backend now sends WhatsApp messages to customers at key stages of the order process:

1. **Order Created** → Order confirmation + STK push notification
2. **Payment Received** → Payment confirmation
3. **Order Delivered** → Delivery confirmation

## Setup Steps

### Step 1: Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free account
3. Verify your phone number
4. You'll get $15 free credit

### Step 2: Set Up WhatsApp Sandbox

Since you're testing, use Twilio's WhatsApp Sandbox (production requires WhatsApp Business approval):

1. Go to https://console.twilio.com
2. Navigate to: **Messaging** → **Try it out** → **Send a WhatsApp message**
3. You'll see a sandbox number like: `+1 415 523 8886`
4. **Join the sandbox:**
   - Send a WhatsApp message from your phone to that number
   - Message format: `join [your-sandbox-code]`
   - Example: `join happy-tiger`
   - You'll get a confirmation

### Step 3: Get Your Credentials

1. In Twilio Console, go to **Account** → **API keys & tokens**
2. Copy these values:
   - **Account SID** (starts with AC...)
   - **Auth Token** (click to reveal)

### Step 4: Add to .env File

Update your `backend/.env` file:

```env
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=AC...your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

**Note:** The WhatsApp number format is: `whatsapp:+[country_code][number]`

### Step 5: Add to Render Environment Variables

1. Go to your Render dashboard
2. Select your `tj-resturant` service
3. Click **Environment**
4. Add these variables:
   - `TWILIO_ACCOUNT_SID` = Your Account SID
   - `TWILIO_AUTH_TOKEN` = Your Auth Token
   - `TWILIO_WHATSAPP_NUMBER` = `whatsapp:+14155238886` (or your sandbox number)

5. Click **Save Changes**

Render will automatically redeploy.

## What Gets Sent

### 1. Order Confirmation (When order is created)
```
🍽️ Order Confirmation - TJ Restaurant

Thank you for your order!

📋 Order Details:
- Food Item: Chicken Burger
- Room Number: 204
- Order ID: #5

💳 Payment:
An M-Pesa STK push has been sent to your phone.
Please enter your PIN to complete payment.

⏱️ Your order will be prepared once payment is confirmed.

Thank you! 🙏
```

### 2. Payment Confirmation (When M-Pesa payment succeeds)
```
✅ Payment Confirmed - TJ Restaurant

Payment received successfully!

📋 Order Details:
- Food Item: Chicken Burger
- Room Number: 204
- Order ID: #5

👨‍🍳 Your order is now being prepared.
We'll deliver it to your room shortly.

Estimated time: 15-20 minutes

Enjoy your meal! 🍽️
```

### 3. Delivery Notification (When order is marked as delivered)
```
🚪 Order Delivered - TJ Restaurant

Your order has been delivered!

📋 Order Details:
- Food Item: Chicken Burger
- Room Number: 204
- Order ID: #5

Enjoy your meal! 😊

Rate your experience:
👍 Good | 👎 Needs Improvement

Thank you for choosing TJ Restaurant! 🙏
```

## Testing

### Test Flow:

1. **Create an order via Postman:**
```json
POST https://tj-resturant.onrender.com/orders
{
  "food_item": "Chicken Burger",
  "room_number": "204",
  "phone": "0712345678",
  "channel": "whatsapp",
  "amount": 450
}
```

2. **Check your WhatsApp**
   - You should receive: Order confirmation message

3. **Wait for M-Pesa callback** (~30-60 seconds)
   - You should receive: Payment confirmation message

4. **Mark as delivered:**
```json
PATCH https://tj-resturant.onrender.com/orders/5
{
  "status": "delivered"
}
```

5. **Check your WhatsApp**
   - You should receive: Delivery notification

## Phone Number Format

The system automatically handles Kenyan phone numbers:

- Input: `0712345678`
- Converted to: `whatsapp:+254712345678`

For other countries, adjust the formatting in `services/twilio.js`.

## Troubleshooting

### Error: "Not a valid phone number"
- Ensure customer phone is joined to WhatsApp sandbox
- Check phone number format (should be 10 digits starting with 0)

### Error: "Account not authorized"
- Verify Twilio credentials are correct
- Check Account SID and Auth Token in Render

### Messages not received
- Ensure you've joined the sandbox (send `join [code]` to sandbox number)
- Check Twilio Console → Messaging → Logs for errors
- Verify phone number format is correct

### Sandbox limitations
- Only pre-approved numbers can receive messages
- 24-hour session limit (must rejoin after 24h)
- For production, apply for WhatsApp Business approval

## Production Setup

For production (after testing):

1. **Apply for WhatsApp Business Profile:**
   - Go to Twilio Console → Messaging → Senders → WhatsApp senders
   - Click "Request to enable my Twilio numbers"
   - Complete WhatsApp Business profile
   - Wait for approval (can take days)

2. **Update WhatsApp Number:**
   - Once approved, update `TWILIO_WHATSAPP_NUMBER`
   - No more sandbox restrictions

3. **Message Templates:**
   - For production, use WhatsApp-approved message templates
   - Submit templates for approval in Twilio Console

## Cost

**Sandbox:** Free (for testing)
**Production:** ~$0.005 per message (varies by country)

Check current pricing: https://www.twilio.com/pricing/messaging

## Code Reference

All WhatsApp logic is in:
- `backend/services/twilio.js` - Twilio client & message functions
- `backend/routes/orders.js` - Sends order & delivery notifications
- `backend/routes/mpesa.js` - Sends payment confirmation

## Environment Variables Summary

```env
# Required for WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

## Next Steps

1. Create Twilio account
2. Join WhatsApp sandbox
3. Add credentials to Render
4. Test the complete flow
5. (Optional) Apply for production WhatsApp approval

---

**Ready to test?** Add your Twilio credentials and create an order! 📱
