# Firebase Push Notifications Setup Guide

This guide will help you set up push notifications so the admin receives alerts when orders are paid.

## Part 1: Flutter App Setup

### Step 1: Create Firebase Project
1. Go to https://console.firebase.google.com
2. Click **"Create a project"**
3. Name: `hotel-admin` or `TJ Restaurant`
4. Disable Google Analytics (optional)
5. Click **Create project**

### Step 2: Add Android App
1. In Firebase Console, click the Android icon
2. Enter package name: `com.example.hotel_admin`
3. Download `google-services.json`
4. Place it in: `hotel_admin/android/app/google-services.json`

### Step 3: Run Flutter App
```bash
cd hotel_admin
flutter pub get
flutter run
```

### Step 4: Get FCM Token
When the app runs, check the console output for:
```
════════════════════════════════════════
FCM Token: [LONG_TOKEN_STRING]
════════════════════════════════════════
```

**COPY THIS TOKEN** - you'll need it for Render!

## Part 2: Firebase Admin SDK Setup (Backend)

### Step 1: Get Service Account Credentials
1. In Firebase Console, click gear icon ⚙️ → **Project settings**
2. Go to **Service accounts** tab
3. Click **Generate new private key**
4. Download the JSON file

The downloaded file will look like:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com",
  ...
}
```

### Step 2: Add Credentials to Render

Go to your Render dashboard → Environment variables and add these:

| Key | Value | Where to Find |
|-----|-------|---------------|
| `FIREBASE_PROJECT_ID` | `your-project-id` | From JSON: `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxxxx@...` | From JSON: `client_email` |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | From JSON: `private_key` |
| `ADMIN_FCM_TOKEN` | [Token from Step 4 above] | From Flutter app console |

**Important for FIREBASE_PRIVATE_KEY:**
- Copy the entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Keep the `\n` characters as-is (they represent newlines)

### Step 3: Deploy Backend

```bash
cd backend
git add .
git commit -m "Add Firebase push notifications"
git push origin main
```

Render will automatically redeploy.

## Part 3: Testing

### Test the Complete Flow:

1. **Create an order** (via Postman or Flutter app):
   ```
   POST https://tj-resturant.onrender.com/orders
   {
     "food_item": "Chicken Burger",
     "room_number": "204",
     "phone": "0708374149",
     "channel": "phone_call",
     "amount": 450
   }
   ```

2. **Wait for M-Pesa callback** (30-60 seconds in sandbox)

3. **Check your phone** - You should receive a notification:
   ```
   🔔 New Paid Order!
   Room 204 ordered Chicken Burger
   ```

4. **Check Render logs** for:
   ```
   ✅ Firebase Admin initialized
   ✅ Order X marked as paid
   ✅ Notification sent successfully
   ```

## Troubleshooting

### Firebase not initializing
**Error:** `⚠️ Firebase credentials not found`
- Check that all 3 Firebase env vars are set in Render
- Verify the values match your downloaded JSON file
- Make sure there are no extra spaces in the environment variable values

### Notification not sent
**Error:** `No FCM token found`
- Verify `ADMIN_FCM_TOKEN` is set in Render
- Run the Flutter app again to get a fresh token
- FCM tokens can expire - regenerate if needed

### Invalid credential error
**Error:** `Firebase initialization error`
- Check `FIREBASE_PRIVATE_KEY` format
- Ensure `\n` characters are preserved (don't replace with actual newlines)
- Verify `client_email` and `project_id` are correct

### Notification sent but not received on phone
- Check phone notification settings - allow notifications for the app
- Make sure Firebase Cloud Messaging is enabled in Firebase Console
- Try uninstalling and reinstalling the app
- Check if token has changed (run app and check console)

## Environment Variables Summary

**Render Backend Environment Variables:**
```
SUPABASE_URL=https://dxxpzgaylzhzcfofbofi.supabase.co
SUPABASE_KEY=your_supabase_key
PORT=3000
BACKEND_URL=https://tj-resturant.onrender.com

# M-Pesa
MPESA_CONSUMER_KEY=your_daraja_key
MPESA_CONSUMER_SECRET=your_daraja_secret
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_SHORTCODE=174379
MPESA_CALLBACK_URL=https://tj-resturant.onrender.com/mpesa/callback

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
ADMIN_FCM_TOKEN=your_device_fcm_token_from_flutter_app
```

## Next Steps

Once notifications are working:
- Customize notification sound in Flutter
- Add notification tap handling to open specific order
- Add notification channels for different order statuses
- Support multiple admin devices (store FCM tokens in database)
