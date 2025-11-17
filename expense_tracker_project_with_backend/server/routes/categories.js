const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    // Return both global categories (user_id is NULL) and user-specific
    const q = await pool.query(
      `SELECT id, name, color, icon FROM categories WHERE user_id IS NULL OR user_id=$1 ORDER BY name ASC`, 
      [req.user.id]
    );
    res.json(q.rows);
  } catch (e) {
    console.error('categories get error', e);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
