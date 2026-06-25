const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Force clean strings by removing quotes, brackets, spaces, or formatting anomalies
const cleanEnvVar = (val) => {
    if (!val) return '';
    return val.replace(/['"\[\]\s]/g, '').trim();
};

let SUPABASE_URL = cleanEnvVar(process.env.SUPABASE_URL);
const SUPABASE_KEY = cleanEnvVar(process.env.SUPABASE_KEY);

// Auto-patch missing https:// protocols if necessary
if (SUPABASE_URL && !SUPABASE_URL.startsWith('http://') && !SUPABASE_URL.startsWith('https://')) {
    SUPABASE_URL = `https://${SUPABASE_URL}`;
}

// Fallback graceful values instead of crashing the server
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("⚠️ WARNING: Supabase keys are not ready yet. Check your Render Dashboard Environment tab!");
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Verify and login accounts securely
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Username and password required." });
        if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: "Backend database configurations are missing." });

        const response = await axios.get(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username.trim())}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        const user = response.data[0];
        if (!user || user.password !== password) {
            return res.status(401).json({ error: "Invalid username or password." });
        }
        res.json({ username: user.username, role: user.role });
    } catch (err) {
        console.error("Login Error:", err.message);
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
        res.status(400).json({ error: "Account creation failed." });
    }
});

// Fetch payroll rows conditionally based on role
app.get('/api/payroll', async (req, res) => {
    try {
        const { username, role } = req.query;
        let queryUrl = `${SUPABASE_URL}/rest/v1/payroll?select=*`;

        if (role !== 'admin' && username) {
            queryUrl += `&name=eq.${encodeURIComponent(username.trim())}`;
        }

        const response = await axios.get(queryUrl, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        const records = Array.isArray(response.data) ? response.data : [];
        res.json(records);
    } catch (err) {
        console.error("Fetch Payroll Error:", err.message);
        res.json([]);
    }
});

// Post a new payroll log item
app.post('/api/payroll', async (req, res) => {
    try {
        const { name, league, date, games, rate, createdBy } = req.body;
        const newEntry = {
            name: name.trim(), 
            league, 
            date,
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
    console.log(`🚀 RIBRO Inc. Server Engine running successfully on port ${PORT}`);
});
