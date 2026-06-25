const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Check if configuration variables are loaded correctly
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("CRITICAL ERROR: Supabase environment variables are missing!");
    process.exit(1);
}

// Middleware setup
app.use(cors());
app.use(express.json());

// Serve static frontend files (HTML, CSS, Images, JS)
app.use(express.static(path.join(__dirname, 'public')));

// =========================================================================
// 🚀 NEW ADDITION: ACCOUNT AUTHENTICATION ROUTES (MEMBERS & ADMIN)
// =========================================================================

// API: Verify and login accounts securely
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required." });
        }

        // Query the Supabase users table matching username criteria
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, {
            headers: {
                'apikey': SUPABASE_KEY.trim(),
                'Authorization': `Bearer ${SUPABASE_KEY.trim()}`
            }
        });

        const user = response.data[0];
        
        // Verify user presence and password string match
        if (!user || user.password !== password) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        // Return user context to safely save in active dashboard session state
        res.json({ username: user.username, role: user.role });
    } catch (err) {
        console.error("Login API Error:", err.response?.data || err.message);
        res.status(500).json({ error: "Authentication pipeline encounter an error." });
    }
});

// API: Exclusive Admin control path to generate individual referee accounts
app.post('/api/users', async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required." });
        }

        const newUser = {
            username: username.trim(),
            password: password.trim(),
            role: role || 'member'
        };

        // Write row insertion data array direct into Supabase user table records
        const response = await axios.post(`${SUPABASE_URL}/rest/v1/users`, newUser, {
            headers: {
                'apikey': SUPABASE_KEY.trim(),
                'Authorization': `Bearer ${SUPABASE_KEY.trim()}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        res.status(201).json(response.data);
    } catch (err) {
        console.error("User Registration API Error:", err.response?.data || err.message);
        res.status(400).json({ error: "Account generation rejected. This username may already be taken." });
    }
});

// =========================================================================
// EXISTING FUNCTIONAL API ENDPOINTS: PAYROLL MANAGEMENT CORE LOGIC
// =========================================================================

// Fetch entries dynamically based on logged in account roles
app.get('/api/payroll', async (req, res) => {
    try {
        const { username, role } = req.query;
        let queryUrl = `${SUPABASE_URL}/rest/v1/payroll?select=*`;

        // If user is a member, append filter conditions to hide other entries
        if (role !== 'admin' && username) {
            queryUrl += `&name=eq.${encodeURIComponent(username)}`;
        }

        const response = await axios.get(queryUrl, {
            headers: {
                'apikey': SUPABASE_KEY.trim(),
                'Authorization': `Bearer ${SUPABASE_KEY.trim()}`
            }
        });

        res.json(response.data);
    } catch (err) {
        console.error("Error reading database table:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to read data from Supabase backend." });
    }
});

// Post a new referee payroll entry transaction layout log
app.post('/api/payroll', async (req, res) => {
    try {
        const { name, league, date, games, rate, createdBy } = req.body;

        const calculatedTotal = (parseInt(games) || 0) * (parseFloat(rate) || 0);

        const newEntry = {
            name,
            league,
            date,
            games: parseInt(games),
            rate: parseFloat(rate),
            total: calculatedTotal,
            createdBy: createdBy || name
        };

        const response = await axios.post(`${SUPABASE_URL}/rest/v1/payroll`, newEntry, {
            headers: {
                'apikey': SUPABASE_KEY.trim(),
                'Authorization': `Bearer ${SUPABASE_KEY.trim()}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        res.status(201).json(response.data);
    } catch (err) {
        console.error("Error writing payroll entry:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to register record transaction entries." });
    }
});

// Delete target line items via matching Row Reference UUID String code
app.delete('/api/payroll/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const response = await axios.delete(`${SUPABASE_URL}/rest/v1/payroll?id=eq.${id}`, {
            headers: {
                'apikey': SUPABASE_KEY.trim(),
                'Authorization': `Bearer ${SUPABASE_KEY.trim()}`,
                'Prefer': 'return=representation'
            }
        });

        res.json({ message: "Row deleted successfully from database ledger.", details: response.data });
    } catch (err) {
        console.error("Error deleting data row:", err.response?.data || err.message);
        res.status(500).json({ error: "Database rejected targeted log deletion query rule." });
    }
});

// Fallback rule mapping to redirect traffic default to main app dashboard
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize server pipeline listen monitor sequence
app.listen(PORT, () => {
    console.log(`===========================================================`);
    console.log(`🚀 RIBRO Inc. Production Server Engine Online!`);
    console.log(`📡 Local Port Access Reference Address: http://localhost:${PORT}`);
    console.log(`===========================================================`);
});
