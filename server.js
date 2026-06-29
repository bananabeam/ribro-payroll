const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const cleanEnvVar = (val) => {
    if (!val) return '';
    return val.replace(/['"\[\]\s]/g, '').trim();
};

let SUPABASE_URL = cleanEnvVar(process.env.SUPABASE_URL);
const SUPABASE_KEY = cleanEnvVar(process.env.SUPABASE_KEY);

if (SUPABASE_URL && !SUPABASE_URL.startsWith('http://') && !SUPABASE_URL.startsWith('https://')) {
    SUPABASE_URL = `https://${SUPABASE_URL}`;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Verify and login accounts securely with lock validation
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Username and password required." });

        const response = await axios.get(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username.trim())}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        const user = response.data[0];
        if (!user || user.password !== password) {
            return res.status(401).json({ error: "Invalid username or password." });
        }
        
        // Block login if account is locked
        if (user.status === 'locked') {
            return res.status(403).json({ error: "This account has been locked by the administrator." });
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
        const newUser = { 
            username: username.trim(), 
            password: password.trim(), 
            role: role || 'member',
            status: 'active' // Default status explicitly tracked
        };

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

// API: Admin fetches all columns for management view
app.get('/api/users', async (req, res) => {
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=id,username,role,status`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: "Failed to retrieve members list." });
    }
});

// NEW API: Admin updates a member's username
app.put('/api/users/:id', async (req, res) => {
    try {
        const { username } = req.body;
        const response = await axios.patch(`${SUPABASE_URL}/rest/v1/users?id=eq.${req.params.id}`, 
            { username: username.trim() },
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
            }
        );
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: "Failed to update member username." });
    }
});

// NEW API: Admin toggles status lock on an account
app.patch('/api/users/:id/toggle-lock', async (req, res) => {
    try {
        const { status } = req.body; // Expects 'active' or 'locked'
        const response = await axios.patch(`${SUPABASE_URL}/rest/v1/users?id=eq.${req.params.id}`, 
            { status },
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
            }
        );
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: "Failed to toggle account lock state." });
    }
});

// NEW API: Admin deletes a user account completely
app.delete('/api/users/:id', async (req, res) => {
    try {
        const response = await axios.delete(`${SUPABASE_URL}/rest/v1/users?id=eq.${req.params.id}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: "Failed to delete user account." });
    }
});

// API: Admin resets a member's password
app.patch('/api/users/reset-password', async (req, res) => {
    try {
        const { username, newPassword } = req.body;
        const response = await axios.patch(
            `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username.trim())}`,
            { password: newPassword.trim() },
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
            }
        );
        if (response.data.length === 0) return res.status(404).json({ error: "User not found." });
        res.json({ message: `Password for ${username} has been successfully reset.` });
    } catch (err) {
        res.status(500).json({ error: "Failed to reset password." });
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
        res.json(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
        res.json([]);
    }
});

// Post a new payroll log item
app.post('/api/payroll', async (req, res) => {
    try {
        const { name, league, date, games, rate } = req.body;
        const newEntry = {
            name: name.trim(), 
            league: league.trim(), 
            date,
            games: parseInt(games) || 0,
            rate: parseFloat(rate) || 0,
            total: (parseInt(games) || 0) * (parseFloat(rate) || 0)
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
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
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
    console.log(`🚀 Server Engine running on port ${PORT}`);
});
