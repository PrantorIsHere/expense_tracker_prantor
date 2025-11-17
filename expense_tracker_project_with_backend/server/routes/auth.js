const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    if (!username || !email || !password || !name) return res.status(400).json({ error: 'All fields are required' });
    const existing = await pool.query('SELECT 1 FROM users WHERE username=$1 OR email=$2', [username, email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Username or email already exists' });
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const password_hash = await bcrypt.hash(password, rounds);
    const inserted = await pool.query(
      'INSERT INTO users (username,email,password_hash,name) VALUES ($1,$2,$3,$4) RETURNING id,username,email,name',
      [username, email, password_hash, name]
    );
    const user = inserted.rows[0];
    // default settings
    await pool.query('INSERT INTO settings (user_id) VALUES ($1)', [user.id]);
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.status(201).json({ message: 'User created', user, token });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const q = await pool.query('SELECT id,username,email,name,password_hash FROM users WHERE username=$1 OR email=$1', [username]);
    if (q.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = q.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    delete user.password_hash;
    res.json({ message: 'Login successful', user, token });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// current user
const { authenticateToken } = require('../middleware/auth');
router.get('/me', authenticateToken, (req, res) => res.json({ user: req.user }));

module.exports = router;
