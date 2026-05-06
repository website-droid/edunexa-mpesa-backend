const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Your PesaPal Keys
const CONSUMER_KEY = "Qssi7Rdu2D5tqRInucPXxjuKmrP9d2dq";
const CONSUMER_SECRET = "NmNY83aIe/lhbHs7ZhQqwNwDmbg=";
const BASE_URL = "https://pay.pesapal.com/v3";

console.log("✅ PesaPal Backend Starting...");

// Generate OAuth token
async function getPesapalToken() {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const response = await axios.post(`${BASE_URL}/api/Auth/RequestToken`, {}, {
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
    });
    return response.data.token;
}

// Test endpoint
app.get('/', (req, res) => {
    res.json({ status: 'active', message: 'EduMark PesaPal Backend is running!' });
});

// Submit order to PesaPal
app.post('/api/pesapal/submit', async (req, res) => {
    try {
        const { amount, phone, email, userType, plan, userId } = req.body;
        console.log("📱 Payment request:", { amount, phone, email, userType, plan });
        
        const token = await getPesapalToken();
        
        const orderData = {
            id: `EDU_${Date.now()}`,
            currency: "KES",
            amount: amount,
            description: `${userType} Subscription - ${plan} Plan`,
            callback_url: `${process.env.BACKEND_URL || req.headers.origin}/api/pesapal/callback`,
            billing_details: {
                email_address: email,
                phone_number: phone,
                country_code: "KE"
            }
        };
        
        const response = await axios.post(`${BASE_URL}/api/Transactions/SubmitOrderRequest`, orderData, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        
        res.json({ 
            success: true, 
            redirect_url: response.data.redirect_url, 
            order_tracking_id: response.data.order_tracking_id 
        });
        
    } catch(e) {
        console.error("❌ Error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// Callback endpoint
app.get('/api/pesapal/callback', (req, res) => {
    console.log("✅ Payment callback:", req.query);
    res.send(`
        <html>
            <head><title>Payment Successful!</title>
            <style>body{font-family:Arial;text-align:center;padding:50px;}</style>
            </head>
            <body>
                <h1 style="color:green;">✅ Payment Successful!</h1>
                <p>Your EduMark AI subscription has been activated.</p>
                <p>You can close this window and return to the app.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
            </body>
        </html>
    `);
});

// Check payment status
app.post('/api/pesapal/status', async (req, res) => {
    try {
        const { order_tracking_id } = req.body;
        const token = await getPesapalToken();
        const response = await axios.get(`${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${order_tracking_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        res.json(response.data);
    } catch(e) {
        res.json({ payment_status_description: "Pending" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Your backend URL will be: https://your-app.onrender.com`);
});
