const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ─── Transaction History (named quick-pick items) ──────────────────────────

// GET /api/additional-info/transactions
router.get('/transactions', authenticateToken, (req, res) => {
  try {
    const items = db.get('transaction_history')
      .filter({ user_id: req.user.id })
      .value()
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(items);
  } catch (e) {
    console.error('get transaction history error', e);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

// POST /api/additional-info/transactions — bulk replace (full list save)
router.post('/transactions', authenticateToken, (req, res) => {
  try {
    const { items } = req.body; // array of { id?, name, amount }
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

    const userId = req.user.id;
    const now = new Date().toISOString();

    // Remove old records for this user then insert new ones
    db.get('transaction_history').remove({ user_id: userId }).write();

    const newItems = items.map(item => ({
      id:      item.id || uuidv4(),
      user_id: userId,
      name:    item.name,
      amount:  item.amount !== undefined ? parseFloat(item.amount) : 0,
      created_at: now,
    }));

    newItems.forEach(item => db.get('transaction_history').push(item).write());
    res.json(newItems);
  } catch (e) {
    console.error('save transaction history error', e);
    res.status(500).json({ error: 'Failed to save transaction history' });
  }
});

// ─── Rent History ───────────────────────────────────────────────────────────

// GET /api/additional-info/rent
router.get('/rent', authenticateToken, (req, res) => {
  try {
    const items = db.get('rent_history')
      .filter({ user_id: req.user.id })
      .value()
      .sort((a, b) => b.date.localeCompare(a.date));
    res.json(items);
  } catch (e) {
    console.error('get rent history error', e);
    res.status(500).json({ error: 'Failed to fetch rent history' });
  }
});

// POST /api/additional-info/rent — bulk replace
router.post('/rent', authenticateToken, (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

    const userId = req.user.id;
    const now = new Date().toISOString();

    db.get('rent_history').remove({ user_id: userId }).write();

    const newItems = items.map(item => ({
      id:        item.id || uuidv4(),
      user_id:   userId,
      month:     item.month,
      amount:    item.amount !== undefined ? parseFloat(item.amount) : 0,
      date:      item.date,
      deedNote:  item.deedNote || '',
      created_at: now,
    }));

    newItems.forEach(item => db.get('rent_history').push(item).write());
    res.json(newItems);
  } catch (e) {
    console.error('save rent history error', e);
    res.status(500).json({ error: 'Failed to save rent history' });
  }
});

// ─── Gadget Warranties ──────────────────────────────────────────────────────

// GET /api/additional-info/gadgets
router.get('/gadgets', authenticateToken, (req, res) => {
  try {
    const items = db.get('gadget_warranties')
      .filter({ user_id: req.user.id })
      .value()
      .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
    res.json(items);
  } catch (e) {
    console.error('get gadget warranties error', e);
    res.status(500).json({ error: 'Failed to fetch gadget warranties' });
  }
});

// POST /api/additional-info/gadgets — bulk replace
router.post('/gadgets', authenticateToken, (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

    const userId = req.user.id;
    const now = new Date().toISOString();

    db.get('gadget_warranties').remove({ user_id: userId }).write();

    const newItems = items.map(item => ({
      id:             item.id || uuidv4(),
      user_id:        userId,
      productId:      item.productId || '',
      serialNumber:   item.serialNumber || '',
      name:           item.name,
      purchaseDate:   item.purchaseDate,
      warrantyMonths: item.warrantyMonths !== undefined ? parseInt(item.warrantyMonths, 10) : 12,
      note:           item.note || '',
      created_at:     now,
    }));

    newItems.forEach(item => db.get('gadget_warranties').push(item).write());
    res.json(newItems);
  } catch (e) {
    console.error('save gadget warranties error', e);
    res.status(500).json({ error: 'Failed to save gadget warranties' });
  }
});

module.exports = router;
