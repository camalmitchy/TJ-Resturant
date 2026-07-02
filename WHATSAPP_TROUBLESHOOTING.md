# WhatsApp Bot Troubleshooting Guide

## ✅ Fixes Applied

1. **Added URL-encoded body parser** - Twilio sends form data, not JSON
2. **Added detailed logging** - See exactly what Twilio sends
3. **Added test endpoint** - Verify webhook is reachable
4. **Added input validation** - Better error handling

## 🧪 Testing Steps

### Step 1: Test Webhook Endpoint

Open this URL in your browser:
```
https://tj-resturant.onrender.com/whatsapp/test
```

**Expected response:**
```json
{
  "status": "WhatsApp webhook is working!",
  "timestamp": "2026-07-02T...",
  "twilioConfigured": true
}
```

If `twilioConfigured: false`, add Twilio credentials to Render.

### Step 2: Wait for Render Deployment

1. Go to: https://dashboard.render.com
2. Select your service: `tj-resturant`
3. Click **Logs**
4. Wait for: `Deploy live`
5. Should see: `✅ Twilio initialized`

### Step 3: Verify Twilio Webhook

1. Go to: https://console.twilio.com
2. **Messaging** → **Try it out** → **Send a WhatsApp message**
3. Verify webhook URL is:
   ```
   https://tj-resturant.onrender.com/whatsapp/incoming
   ```
4. Method: **HTTP POST**

### Step 4: Test Bot

1. **Join sandbox** (if not already):
   - Send to sandbox number: `join [your-code]`

2. **Send test message:**
   ```
   hi
   ```

3. **Check Render logs immediately:**
   - Should see: `=== WhatsApp Webhook Received ===`
   - Should see: `From: whatsapp:+254...`
   - Should see: `Message: hi`

### Step 5: Check for Errors

**Look for these in Render logs:**

✅ **Good signs:**
```
✅ Twilio initialized
=== WhatsApp Webhook Received ===
From: whatsapp:+254712345678 - Message: hi
WhatsApp message sent to: whatsapp:+254712345678
```

❌ **Bad signs:**
```
⚠️ Twilio credentials not found
❌ Missing From or Body in request
Error sending WhatsApp message: ...
```

## 🔍 Common Issues

### Issue 1: "twilioConfigured: false"

**Problem:** Twilio credentials not in Render

**Solution:**
1. Go to Render dashboard
2. Environment → Add:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_NUMBER`
3. Save → Auto redeploy

### Issue 2: Webhook receives no data

**Problem:** Render deployment not complete

**Solution:**
- Wait 2-3 minutes for deployment
- Check logs for "Deploy live"
- Retry sending message

### Issue 3: Bot receives message but doesn't respond

**Problem:** Conversations table doesn't exist

**Solution:**
1. Go to Supabase SQL Editor
2. Run: `supabase_conversations_migration.sql`
3. Verify table exists

### Issue 4: "Error sending WhatsApp message"

**Problem:** Wrong Twilio credentials or sandbox not joined

**Solution:**
1. Verify credentials in Render match Twilio Console
2. Ensure you've joined the sandbox
3. Check phone number format: `whatsapp:+14155238886`

### Issue 5: Twilio shows "11200 HTTP retrieval failure"

**Problem:** Webhook URL unreachable

**Solution:**
1. Test: `https://tj-resturant.onrender.com/whatsapp/test`
2. If fails, check Render is running
3. Verify URL has no typos
4. Check Render logs for errors

## 📊 Debug Checklist

- [ ] Render deployment complete
- [ ] Test endpoint works (`/whatsapp/test`)
- [ ] Twilio credentials in Render
- [ ] Webhook URL correct in Twilio
- [ ] Joined WhatsApp sandbox
- [ ] Conversations table exists in Supabase
- [ ] Logs show webhook received
- [ ] Logs show Twilio initialized

## 🔧 Manual Test Commands

### Test webhook manually with curl:

```bash
curl -X POST https://tj-resturant.onrender.com/whatsapp/incoming \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+254712345678&Body=hi"
```

**Expected:** Should see logs in Render

### Check Twilio configuration:

```bash
# Get your Twilio config (requires Twilio CLI)
twilio api:core:incoming-phone-numbers:list
```

## 📞 Twilio Webhook Requirements

Twilio sends data as **form-urlencoded**, not JSON:

```
Content-Type: application/x-www-form-urlencoded

From=whatsapp%3A%2B254712345678&Body=hi&...
```

Our backend now handles this with:
```javascript
app.use(express.urlencoded({ extended: true }));
```

## 🎯 Next Steps If Still Not Working

1. **Check Render logs:**
   ```
   - Is "=== WhatsApp Webhook Received ===" appearing?
   - Is Twilio initialized?
   - Are there any errors?
   ```

2. **Test with curl:**
   ```bash
   curl https://tj-resturant.onrender.com/whatsapp/test
   ```

3. **Verify Twilio webhook:**
   - URL exact: `https://tj-resturant.onrender.com/whatsapp/incoming`
   - Method: POST
   - No trailing slashes

4. **Check Twilio Console → Monitor → Logs:**
   - See webhook requests
   - Check response codes
   - Look for errors

## 💡 Success Indicators

When working correctly, you'll see:

1. **Render logs:**
   ```
   === WhatsApp Webhook Received ===
   From: whatsapp:+254712345678 - Message: hi
   WhatsApp message sent to: whatsapp:+254712345678
   ```

2. **Twilio Monitor:**
   - Status: 200 OK
   - No errors

3. **Your phone:**
   - Receives menu message
   - Can interact with bot

## 📚 References

- [Twilio WhatsApp Sandbox](https://www.twilio.com/docs/whatsapp/sandbox)
- [Twilio Webhooks](https://www.twilio.com/docs/usage/webhooks)
- [Express URL-encoded](https://expressjs.com/en/api.html#express.urlencoded)

---

**Still having issues?** Share the Render logs and I'll help debug!
