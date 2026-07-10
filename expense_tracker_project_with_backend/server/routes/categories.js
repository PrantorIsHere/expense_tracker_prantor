const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories — global categories (user_id=null) + user-specific ones
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const categories = db.get('categories')
      .filter(c => c.user_id === null || c.user_id === userId)
      .sortBy('name')
      .value();

    res.json(categories);
  } catch (e) {
    console.error('categories get error', e);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
