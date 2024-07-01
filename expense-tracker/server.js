const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const db = new sqlite3.Database('./database.db');
const SECRET_KEY = 'your_secret_key';

app.use(bodyParser.json());

// Middleware to authenticate token
function authenticateJWT(req, res, next) {
    const token = req.headers.authorization;
    if (token) {
        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
}

// Register new user
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    db.run(`INSERT INTO Users (username, password) VALUES (?, ?)`, [username, hashedPassword], function(err) {
        if (err) {
            res.status(500).send('User registration failed.');
        } else {
            res.status(201).send({ id: this.lastID });
        }
    });
});

// Login user
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM Users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) {
            return res.status(401).send('Login failed.');
        }
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).send('Login failed.');
        }
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.status(200).send({ token });
    });
});

// Add a new expense
app.post('/expenses', authenticateJWT, (req, res) => {
    const { amount, category, description, date } = req.body;
    const userId = req.user.id;
    db.run(`INSERT INTO Expenses (userId, amount, category, description, date) VALUES (?, ?, ?, ?, ?)`, 
        [userId, amount, category, description, date], function(err) {
        if (err) {
            res.status(500).send('Failed to add expense.');
        } else {
            res.status(201).send({ id: this.lastID });
        }
    });
});

// Get all expenses for the authenticated user
app.get('/expenses', authenticateJWT, (req, res) => {
    const userId = req.user.id;
    db.all(`SELECT * FROM Expenses WHERE userId = ?`, [userId], (err, rows) => {
        if (err) {
            res.status(500).send('Failed to retrieve expenses.');
        } else {
            res.status(200).send(rows);
        }
    });
});

// Delete an expense
app.delete('/expenses/:id', authenticateJWT, (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM Expenses WHERE id = ? AND userId = ?`, [id, req.user.id], function(err) {
        if (err) {
            res.status(500).send('Failed to delete expense.');
        } else if (this.changes === 0) {
            res.status(404).send('Expense not found.');
        } else {
            res.status(204).send();
        }
    });
});

app.listen(3000, () => {
    console.log('Expense Tracker API is running on http://localhost:3000');
});

