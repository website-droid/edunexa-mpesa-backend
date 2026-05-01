const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MPESA_CONFIG = {
    consumerKey: "w9x7XvIXnmDVrLqPr12hs8JZb44Y0EqVWiccNpW5Pz5q60VNFY8BeiJRy7YlGpHD",
    consumerSecret: "90dQP4K1HMSfoARziF4fsCGNkXG5eAGtxS1PbVAJDV7GDxYD",
    shortcode: "174379",
    passkey: "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
    environment: "sandbox"
};

const MPESA_BASE_URL = MPESA_CONFIG.environment === "sandbox" 
    ? "https://sandbox.safaricom.co.ke" 
    : "https://api.safaricom.co.ke";

const pendingTransactions = new Map();

async function getMpesaToken() {
    const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64');
    const response = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { 'Authorization': `Basic ${auth}` }
    });
    return response.data.access_token;
}

app.post('/api/stkpush', async (req, res) => {
    const { phoneNumber, amount, studentName } = req.body;
    try {
        const token = await getMpesaToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(`${MPESA_CONFIG.shortcode}${MPESA_CONFIG.passkey}${timestamp}`).toString('base64');
        let formattedPhone = phoneNumber.replace(/^0+/, '254').replace(/^\+/, '');
        
        const response = await axios.post(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
            BusinessShortCode: MPESA_CONFIG.shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: formattedPhone,
            PartyB: MPESA_CONFIG.shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: `${req.protocol}://${req.get('host')}/api/callback`,
            AccountReference: `EDU${Date.now()}`,
            TransactionDesc: `Student Registration - ${studentName || 'New Student'}`
        }, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        
        if (response.data.ResponseCode === "0") {
            pendingTransactions.set(response.data.CheckoutRequestID, { status: 'pending' });
            res.json({ success: true, checkoutRequestID: response.data.CheckoutRequestID });
        } else {
            res.json({ success: false, message: response.data.ResponseDescription });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/checkstatus', async (req, res) => {
    const { checkoutRequestID } = req.body;
    try {
        const token = await getMpesaToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(`${MPESA_CONFIG.shortcode}${MPESA_CONFIG.passkey}${timestamp}`).toString('base64');
        
        const response = await axios.post(`${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`, {
            BusinessShortCode: MPESA_CONFIG.shortcode,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestID
        }, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        
        res.json({
            success: response.data.ResultCode === "0",
            status: response.data.ResultCode === "0" ? 'completed' : response.data.ResultCode === "1037" ? 'pending' : 'failed',
            message: response.data.ResultDesc
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/callback', (req, res) => {
    console.log('Callback received:', req.body);
    res.json({ ResultCode: 0, ResultDesc: "Success" });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({ message: 'EduNexa M-PESA Backend is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ M-PESA Server running on port ${PORT}`);
});
