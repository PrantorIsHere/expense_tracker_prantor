const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
      ORDER BY t.date DESC, t.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (e) {
    console.error('get transactions error', e);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { voucher_id, title, description, amount, type, category_id, financial_user_id, date } = req.body;
    if (!voucher_id || !title || !amount || !type || !date) return res.status(400).json({ error: 'Required fields missing' });
    const q = await pool.query(`
      INSERT INTO transactions (user_id, voucher_id, title, description, amount, type, category_id, financial_user_id, date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, voucher_id, title, description, amount, type, category_id || null, financial_user_id || null, date]);
    res.status(201).json(q.rows[0]);
  } catch (e) {
    console.error('create transaction error', e);
    if (e.code === '23505') return res.status(400).json({ error: 'Voucher ID already exists' });
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, amount, type, category_id, financial_user_id, date } = req.body;
    const q = await pool.query(`
      UPDATE transactions SET title=$1, description=$2, amount=$3, type=$4, category_id=$5, financial_user_id=$6, date=$7, updated_at=NOW()
      WHERE id=$8 AND user_id=$9 RETURNING *`,
      [title, description, amount, type, category_id || null, financial_user_id || null, date, id, req.user.id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(q.rows[0]);
  } catch (e) {
    console.error('update transaction error', e);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const q = await pool.query('DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING id', [id, req.user.id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('delete transaction error', e);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;
