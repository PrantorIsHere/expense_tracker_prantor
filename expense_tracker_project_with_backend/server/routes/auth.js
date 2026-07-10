const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    if (!username || !email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check for duplicates
    const existing = db.get('users').find(u => u.username === username || u.email === email).value();
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const password_hash = await bcrypt.hash(password, rounds);

    const userId = uuidv4();
    const now = new Date().toISOString();

    const newUser = {
      id: userId,
      username,
      email,
      name,
      password_hash,
      created_at: now,
      updated_at: now,
    };

    db.get('users').push(newUser).write();

    // Default settings
    db.get('settings').push({ id: uuidv4(), user_id: userId, created_at: now }).write();

    const token = jwt.sign(
      { userId: newUser.id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password_hash: _ph, ...safeUser } = newUser;
    res.status(201).json({ message: 'User created', user: safeUser, token });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = db.get('users').find(u => u.username === username || u.email === username).value();
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password_hash: _ph, ...safeUser } = user;
    res.json({ message: 'Login successful', user: safeUser, token });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// GET /api/auth/me
const { authenticateToken } = require('../middleware/auth');
router.get('/me', authenticateToken, (req, res) => res.json({ user: req.user }));

module.exports = router;
