const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/financial-users — all financial users (contacts) for current user
router.get('/', authenticateToken, (req, res) => {
  try {
    const users = db.get('financial_users')
      .filter({ user_id: req.user.id })
      .value()
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(users);
  } catch (e) {
    console.error('get financial users error', e);
    res.status(500).json({ error: 'Failed to fetch financial users' });
  }
});

// POST /api/financial-users — create a financial user
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, email, phone, type, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const now = new Date().toISOString();
    const newUser = {
      id:         uuidv4(),
      user_id:    req.user.id,
      name,
      email:      email || null,
      phone:      phone || null,
      type:       type  || 'contact', // 'contact' | 'business' | 'family' | etc.
      notes:      notes || null,
      created_at: now,
      updated_at: now,
    };
    db.get('financial_users').push(newUser).write();
    res.status(201).json(newUser);
  } catch (e) {
    console.error('create financial user error', e);
    res.status(500).json({ error: 'Failed to create financial user' });
  }
});

// PUT /api/financial-users/:id — update a financial user
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const fu = db.get('financial_users').find({ id, user_id: req.user.id }).value();
    if (!fu) return res.status(404).json({ error: 'Financial user not found' });

    const { name, email, phone, type, notes } = req.body;
    const updated = {
      ...fu,
      name:       name  ?? fu.name,
      email:      email !== undefined ? email : fu.email,
      phone:      phone !== undefined ? phone : fu.phone,
      type:       type  ?? fu.type,
      notes:      notes !== undefined ? notes : fu.notes,
      updated_at: new Date().toISOString(),
    };
    db.get('financial_users').find({ id, user_id: req.user.id }).assign(updated).write();
    res.json(updated);
  } catch (e) {
    console.error('update financial user error', e);
    res.status(500).json({ error: 'Failed to update financial user' });
  }
});

// DELETE /api/financial-users/:id
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const fu = db.get('financial_users').find({ id, user_id: req.user.id }).value();
    if (!fu) return res.status(404).json({ error: 'Financial user not found' });
    db.get('financial_users').remove({ id, user_id: req.user.id }).write();
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('delete financial user error', e);
    res.status(500).json({ error: 'Failed to delete financial user' });
  }
});

module.exports = router;
