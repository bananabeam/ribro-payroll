const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Secure credentials
const SUPABASE_URL = 'https://wiuczrpqdohgkzscqxzz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdWN6cnBxa2RvaGdrenNjcXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNzA4NjIsImV4cCI6MjA5Nzg0Njg2Mn0.heIrphrCU26N8LUbNf0bldAr7MDqB3UwWgifJl4zZCs';

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API: Get payroll entries
app.get('/api/payroll', async (req, res) => {
    const { username, role } = req.query;
    let targetUrl = `${SUPABASE_URL}/rest/v1/payroll?select=*`;
    
    if (role !== 'admin' && username) {
        targetUrl += `&createdBy=ilike.${encodeURIComponent(username)}`;
    }

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY.trim(),
                'Authorization': `Bearer ${SUPABASE_KEY.trim()}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Add entry
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
                'apikey': SUPABASE_KEY.trim(),
                'Authorization': `Bearer ${SUPABASE_KEY.trim()}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(newEntry)
        });
        const data = await response.json();
        res.status(201).json(data[0] || data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Delete entry
app.delete('/api/payroll/:id', async (req, res) => {
    const idToDelete = req.params.id;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/payroll?id=eq.${idToDelete}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY.trim(),
                'Authorization': `Bearer ${SUPABASE_KEY.trim()}`
            }
        });
        res.json({ message: "Entry deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, HOST, () => {
    console.log(`Server running smoothly on http://${HOST}:${PORT}`);
});
