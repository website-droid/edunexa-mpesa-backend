const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// IntaSend Configuration
const INTASEND_CONFIG = {
    secretKey: "ISSecretKey_live_5bc64612-14bd-4e44-9c7d-c4d777ec88e4",
    publishableKey: "ISPubKey_live_290dafc9-0dac-4272-a8c7-49612e146afd",
    tillNumber: "469459"
};

// Initiate STK Push
app.post('/api/stkpush', async (req, res) => {
    const { phoneNumber, amount, studentName } = req.body;
    
    // Format phone number to 254XXXXXXXXX
    let formattedPhone = phoneNumber.replace(/^0+/, '254').replace(/^\+/, '');
    
    console.log(`Initiating STK Push to ${formattedPhone} for KSh ${amount}`);
    
    try {
        const response = await axios.post("https://api.intasend.com/api/v1/payments/mpesa/stk_push/", {
            amount: amount,
            currency: "KES",
            phone_number: formattedPhone,
            email: "payment@edunexa.com",
            api_key: INTASEND_CONFIG.secretKey,
            narrative: `Student Registration - ${studentName}`,
            callback_url: "https://edunexa-mpesa-backend.onrender.com/api/callback"
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INTASEND_CONFIG.secretKey}`
            }
        });
        
        console.log("IntaSend response:", response.data);
        
        if (response.data && (response.data.id || response.data.invoice_id)) {
            res.json({ 
                success: true, 
                checkoutRequestID: response.data.id || response.data.invoice_id,
                message: "STK Push sent successfully"
            });
        } else {
            res.json({ success: false, message: response.data.message || "STK Push failed" });
        }
    } catch (error) {
        console.error("IntaSend error:", error.response?.data || error.message);
        res.json({ success: false, message: error.response?.data?.message || error.message });
    }
});

// Check Payment Status
app.post('/api/checkstatus', async (req, res) => {
    const { checkoutRequestID } = req.body;
    
    console.log(`Checking status for ${checkoutRequestID}`);
    
    try {
        const response = await axios.get(`https://api.intasend.com/api/v1/payments/status/${checkoutRequestID}/`, {
            headers: {
                'Authorization': `Bearer ${INTASEND_CONFIG.secretKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log("Status response:", response.data);
        
        let status = 'pending';
        if (response.data.status === 'completed' || response.data.status === 'success' || response.data.state === 'completed') {
            status = 'completed';
        } else if (response.data.status === 'failed' || response.data.state === 'failed') {
            status = 'failed';
        }
        
        res.json({
            success: status === 'completed',
            status: status,
            message: response.data.message || response.data.status || response.data.state
        });
    } catch (error) {
        console.error("Status check error:", error.message);
        res.json({ success: false, status: 'pending', message: error.message });
    }
});

// Callback URL for IntaSend
app.post('/api/callback', (req, res) => {
    console.log("Callback received:", JSON.stringify(req.body, null, 2));
    res.json({ status: "success" });
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'IntaSend' });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'EduNexa M-PESA Backend is running with IntaSend!',
        endpoints: ['/api/stkpush', '/api/checkstatus', '/api/health']
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`Using IntaSend for M-PESA payments`);
    console.log(`Till Number: ${INTASEND_CONFIG.tillNumber}`);
});
