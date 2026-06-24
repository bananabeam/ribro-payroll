const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ entries: [] }, null, 2));
}

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// API: Get payroll entries (Filtered by user role)
app.get('/api/payroll', (req, res) => {
    const db = readDB();
    const { username, role } = req.query;

    if (role === 'admin') {
        // Admins see everything
        res.json(db.entries);
    } else {
        // Members only see assignments matching their specific username
        const filtered = db.entries.filter(entry => entry.createdBy.toLowerCase() === username.toLowerCase());
        res.json(filtered);
    }
});

// API: Add a new payroll entry
app.post('/api/payroll', (req, res) => {
    const db = readDB();
    const newEntry = {
        id: Date.now().toString(),
        name: req.body.name,
        league: req.body.league,
        date: req.body.date,
        games: parseInt(req.body.games) || 0,
        rate: parseFloat(req.body.rate) || 0,
        total: (parseInt(req.body.games) || 0) * (parseFloat(req.body.rate) || 0),
        createdBy: req.body.createdBy // Tracks who encoded the data
    };
    
    db.entries.push(newEntry);
    writeDB(db);
    res.status(201).json(newEntry);
});

// API: Delete an entry
app.delete('/api/payroll/:id', (req, res) => {
    const db = readDB();
    const idToDelete = req.params.id;
    db.entries = db.entries.filter(entry => entry.id !== idToDelete);
    writeDB(db);
    res.json({ message: "Entry deleted successfully" });
});

app.listen(PORT, () => {
    console.log(`Server running smoothly at http://localhost:${PORT}`);
});