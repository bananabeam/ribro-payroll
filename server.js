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
        
        if (user.status === 'locked') {
            return res.status(403).json({ error: "This account has been locked by the administrator." });
        }

        res.json({ username: user.username, role: user.role });
    } catch (err) {
        res.status(500).json({ error: "Authentication system failure." });
    }
});

// ====================================================
// 🚀 NEW: MEMBER SELF-SERVICE SETTINGS PATHWAY (SUPABASE)
// ====================================================
app.post('/api/users/change-password-self', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Missing required payload property criteria." });
        }

        // 1. First extract data to evaluate security constraints
        const fetchResponse = await axios.get(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username.trim())}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        const targetedUser = fetchResponse.data[0];

        if (!targetedUser) {
            return res.status(404).json({ error: "Target profile directory row not found." });
        }
        if (targetedUser.status === 'locked') {
            return res.status(403).json({ error: "Account structure locked. Modifications restricted." });
        }

        // 2. Perform safe relational write-override matching on password row
        await axios.patch(
            `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username.trim())}`,
            { password: password.trim() },
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
            }
        );

        console.log(`[SECURITY] Self-service passcode rewrite applied for account profile: ${username}`);
        res.json({ message: "Password credential vault updated successfully." });
    } catch (err) {
        res.status(500).json({ error: "Failed to securely update self-service password vault profile." });
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
            status: 'active'
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

// API: Admin fetches all columns for management view safely
app.get('/api/users', async (req, res) => {
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=id,username,role,status`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        
        const userData = Array.isArray(response.data) ? response.data : [];
        const safeUsers = userData.map(u => ({
            ...u,
            status: u.status || 'active',
            role: u.role || 'member'
        }));

        res.json(safeUsers);
    } catch (err) {
        res.json([]);
    }
});

// API: Admin updates a member's username
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

// API: Admin toggles status lock on an account
app.patch('/api/users/:id/toggle-lock', async (req, res) => {
    try {
        const { status } = req.body;
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

// API: Admin deletes a user account completely
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
        
        const data = Array.isArray(response.data) ? response.data : [];
        const cleanData = data.map(item => ({
            ...item,
            status: item.status || 'approved'
        }));
        
        res.json(cleanData);
    } catch (err) {
        res.json([]);
    }
});

// Post a new payroll log item
app.post('/api/payroll', async (req, res) => {
    try {
        const { name, league, date, games, rate, role } = req.body;
        
        const newEntry = {
            name: name.trim(), 
            league: league.trim(), 
            date,
            games: parseInt(games) || 0,
            rate: parseFloat(rate) || 0,
            total: (parseInt(games) || 0) * (parseFloat(rate) || 0),
            status: (role === 'admin') ? 'approved' : 'pending'
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

// API: Admin approves a specific payroll entry
app.patch('/api/payroll/:id/approve', async (req, res) => {
    try {
        const { status } = req.body;
        const response = await axios.patch(`${SUPABASE_URL}/rest/v1/payroll?id=eq.${req.params.id}`, 
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
        res.status(500).json({ error: "Failed to update entry status." });
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

// Fetch withdrawal records conditionally based on role
app.get('/api/withdrawals', async (req, res) => {
    try {
        const { username, role } = req.query;
        let queryUrl = `${SUPABASE_URL}/rest/v1/withdrawals?select=*`;

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

// Post a new withdrawal request
app.post('/api/withdrawals', async (req, res) => {
    try {
        const { name, amount, date } = req.body;
        const newWithdrawal = {
            name: name.trim(),
            amount: parseFloat(amount) || 0,
            date,
            status: 'pending'
        };

        const response = await axios.post(`${SUPABASE_URL}/rest/v1/withdrawals`, newWithdrawal, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });
        res.status(201).json(response.data);
    } catch (err) {
        res.status(500).json({ error: "Failed to process withdrawal request." });
    }
});

// Admin approves or rejects a withdrawal request
app.patch('/api/withdrawals/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const response = await axios.patch(`${SUPABASE_URL}/rest/v1/withdrawals?id=eq.${req.params.id}`, 
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
        res.status(500).json({ error: "Failed to modify withdrawal action status." });
    }
});

// Get deduction metrics filtering cleanly by role context parameters
app.get('/api/deductions', async (req, res) => {
    try {
        const { username, role } = req.query;
        let queryUrl = `${SUPABASE_URL}/rest/v1/deductions?select=*`;

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

// Admin creates a deduction penalty entry
app.post('/api/deductions', async (req, res) => {
    try {
        const { name, reason, amount, date } = req.body;
        const newDeduction = {
            name: name.trim(),
            reason: reason.trim(),
            amount: parseFloat(amount) || 0,
            date
        };

        const response = await axios.post(`${SUPABASE_URL}/rest/v1/deductions`, newDeduction, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });
        res.status(201).json(response.data);
    } catch (err) {
        res.status(500).json({ error: "Failed to store deduction record parameter." });
    }
});

// Admin deletes an existing deduction log entry row
app.delete('/api/deductions/:id', async (req, res) => {
    try {
        const response = await axios.delete(`${SUPABASE_URL}/rest/v1/deductions?id=eq.${req.params.id}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: "Deduction row deletion failed." });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server Engine running on port ${PORT}`);
});
