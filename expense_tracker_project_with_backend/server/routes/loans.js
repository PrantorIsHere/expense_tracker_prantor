const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/loans — all loans for current user
router.get('/', authenticateToken, (req, res) => {
  try {
    const loans = db.get('loans')
      .filter({ user_id: req.user.id })
      .value()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(loans);
  } catch (e) {
    console.error('get loans error', e);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// POST /api/loans — create a loan
router.post('/', authenticateToken, (req, res) => {
  try {
    const { person, amount, type, description, date, due_date, status } = req.body;
    if (!person || amount === undefined || !type || !date) {
      return res.status(400).json({ error: 'person, amount, type, date are required' });
    }
    const now = new Date().toISOString();
    const newLoan = {
      id:          uuidv4(),
      user_id:     req.user.id,
      person,
      amount:      parseFloat(amount),
      type,         // 'given' | 'taken'
      description: description || null,
      date,
      due_date:    due_date || null,
      status:      status || 'pending', // 'pending' | 'paid' | 'partial'
      created_at:  now,
      updated_at:  now,
    };
    db.get('loans').push(newLoan).write();
    res.status(201).json(newLoan);
  } catch (e) {
    console.error('create loan error', e);
    res.status(500).json({ error: 'Failed to create loan' });
  }
});

// PUT /api/loans/:id — update a loan
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const loan = db.get('loans').find({ id, user_id: req.user.id }).value();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const { person, amount, type, description, date, due_date, status } = req.body;
    const updated = {
      ...loan,
      person:      person      ?? loan.person,
      amount:      amount !== undefined ? parseFloat(amount) : loan.amount,
      type:        type        ?? loan.type,
      description: description !== undefined ? description : loan.description,
      date:        date        ?? loan.date,
      due_date:    due_date    !== undefined ? due_date : loan.due_date,
      status:      status      ?? loan.status,
      updated_at:  new Date().toISOString(),
    };
    db.get('loans').find({ id, user_id: req.user.id }).assign(updated).write();
    res.json(updated);
  } catch (e) {
    console.error('update loan error', e);
    res.status(500).json({ error: 'Failed to update loan' });
  }
});

// DELETE /api/loans/:id
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const loan = db.get('loans').find({ id, user_id: req.user.id }).value();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    db.get('loans').remove({ id, user_id: req.user.id }).write();
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('delete loan error', e);
    res.status(500).json({ error: 'Failed to delete loan' });
  }
});

module.exports = router;
