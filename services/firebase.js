const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// You'll need to add your service account JSON file or use environment variables
let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized) return;

    try {
        // Option 1: Using service account key file (for local development)
        // const serviceAccount = require('../firebase-service-account.json');
        // admin.initializeApp({
        //     credential: admin.credential.cert(serviceAccount)
        // });

        // Option 2: Using environment variables (recommended for production)
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                })
            });
            firebaseInitialized = true;
            console.log('✅ Firebase Admin initialized');
        } else {
            console.warn('⚠️  Firebase credentials not found. Push notifications disabled.');
        }
    } catch (error) {
        console.error('❌ Firebase initialization error:', error.message);
    }
}

// Send push notification to admin
async function sendOrderNotification(orderData) {
    if (!firebaseInitialized) {
        console.log('Firebase not initialized, skipping notification');
        return;
    }

    const fcmToken = process.env.ADMIN_FCM_TOKEN;

    if (!fcmToken) {
        console.log('No FCM token found, skipping notification');
        return;
    }

    try {
        const message = {
            notification: {
                title: '🔔 New Paid Order!',
                body: `Room ${orderData.room_number} ordered ${orderData.food_item}`,
            },
            data: {
                order_id: String(orderData.id),
                room_number: orderData.room_number,
                food_item: orderData.food_item,
                type: 'order_paid',
            },
            token: fcmToken,
        };

        const response = await admin.messaging().send(message);
        console.log('✅ Notification sent successfully:', response);
    } catch (error) {
        console.error('❌ Error sending notification:', error.message);
    }
}

module.exports = {
    initializeFirebase,
    sendOrderNotification,
};
