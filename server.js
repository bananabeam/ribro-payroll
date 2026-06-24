const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ YOUR DEPLOYED SUPABASE CREDENTIALS PRESERVED
const SUPABASE_URL = 'https://wiuczrpqdohgkzscqxzz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdWN6cnBxa2RvaGdrenNjcXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNzA4NjIsImV4cCI6MjA5Nzg0Njg2Mn0.heIrphrCU26N8LUbNf0bldAr7MDqB3UwWgifJl4zZCs';

// Configured wide-open CORS protocols to authorize Android/mobile browsers
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static(__dirname));

// 🚀 CRITICAL MOBILE FIX: Force the server to explicitly handle and route index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API: Get payroll entries from Supabase
app.get('/api/payroll', async (req, res) => {
    const { username, role } = req.query;
    let targetUrl = `${SUPABASE_URL}/rest/v1/payroll?select=*`;
    
    if (role !== 'admin') {
        targetUrl += `&createdBy=ilike.${encodeURIComponent(username)}`;
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Add a new payroll entry to Supabase
app.post('/api/payroll', async (req, res) => {
    const newEntry = {
        id: Date.now().toString(),
        name: req.body.name,
        league: req.body.league,
        date: req.body.date,
        games: parseInt(req.body.games) || 0,
        rate: parseFloat(req.body.rate) || 0,
        total: (parseInt(req.body.games) || 0) * (parseFloat(req.body.rate) || 0),
        createdBy: req.body.createdBy
    };

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/payroll`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(newEntry)
        });
        const data = await response.json();
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Delete an entry from Supabase
app.delete('/api/payroll/:id', async (req, res) => {
    const idToDelete = req.params.id;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/payroll?id=eq.${idToDelete}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        res.json({ message: "Entry deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running smoothly on port ${PORT}`);
});