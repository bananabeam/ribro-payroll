const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Read the variables from the Render Dashboard Environment
let SUPABASE_URL = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : '';
const SUPABASE_KEY = process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.trim() : '';

// Auto-patch missing https:// protocols if necessary
if (SUPABASE_URL && !SUPABASE_URL.startsWith('http://') && !SUPABASE_URL.startsWith('https://')) {
    SUPABASE_URL = `https://${SUPABASE_URL}`;
}

// Validation check to prevent empty boot errors
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("CRITICAL ERROR: Supabase environment variables are missing on Render!");
    process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Verify and login accounts securely
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Username and password required." });

        const response = await axios.get(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        const user = response.data[0];
        if (!user || user.password !== password) {
            return res.status(401).json({ error: "Invalid username or password." });
        }
        res.json({ username: user.username, role: user.role });
    } catch (err) {
        res.status(500).json({ error: "Authentication system failure." });
    }
});

// API: Admin creates new member accounts
app.post('/api/users', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const newUser = { username: username.trim(), password: password.trim(), role: role || 'member' };

        const response = await axios.post(`${SUPABASE_URL}/rest/v1/users`, newUser, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });
        res.status(201).json(response.data);
    } catch (err) {
        res.status(400).json({ error: "Account creation failed. Username might be taken." });
    }
});

// ==========================================
// 🛠️ FIXED ROUTE: SAFE ARRAY HANDLER FETCH
// ==========================================
app.get('/api/payroll', async (req, res) => {
    try {
        const { username, role } = req.query;
        let queryUrl = `${SUPABASE_URL}/rest/v1/payroll?select=*`;

        // Filter out records to match the user's name exactly if they are not an admin
        if (role !== 'admin' && username) {
            queryUrl += `&name=eq.${encodeURIComponent(username.trim())}`;
        }

        const response = await axios.get(queryUrl, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        // Always guarantee an array payload to protect frontend loops
        const records = Array.isArray(response.data) ? response.data : [];
        res.json(records);
    } catch (err) {
        console.error("Database Fetch Error:", err.response?.data || err.message);
        // Safely return an empty array back so the table component doesn't crash
        res.json([]);
    }
});

// Post a new payroll log item
app.post('/api/payroll', async (req, res) => {
    try {
        const { name, league, date, games, rate, createdBy } = req.body;
        const newEntry = {
            name, league, date,
            games: parseInt(games) || 0,
            rate: parseFloat(rate) || 0,
            total: (parseInt(games) || 0) * (parseFloat(rate) || 0),
            createdBy: createdBy || name
        };

        const response = await axios.post(`${SUPABASE_URL}/rest/v1/payroll`, newEntry, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });
        res.status(201).json(response.data);
    } catch (err) {
        res.status(500).json({ error: "Failed to save data." });
    }
});

// Delete assignment entry rows
app.delete('/api/payroll/:id', async (req, res) => {
    try {
        const response = await axios.delete(`${SUPABASE_URL}/rest/v1/payroll?id=eq.${req.params.id}`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation'
            }
        });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: "Deletion failed." });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 RIBRO Inc
