const express = require('express');
const { v4: uuidv4 } = require('uuid');
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

// POST /api/categories — create a user-specific category
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const userId = req.user.id;

    // Check for duplicate name (global or user-owned)
    const duplicate = db.get('categories')
      .find(c => (c.user_id === null || c.user_id === userId) && c.name.toLowerCase() === name.trim().toLowerCase())
      .value();
    if (duplicate) {
      return res.status(409).json({ error: 'Category already exists' });
    }

    const now = new Date().toISOString();
    const newCat = {
      id:         uuidv4(),
      user_id:    userId,
      name:       name.trim(),
      color:      color || `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
      icon:       icon  || '📦',
      created_at: now,
      updated_at: now,
    };

    db.get('categories').push(newCat).write();
    res.status(201).json(newCat);
  } catch (e) {
    console.error('categories create error', e);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id — update a category
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const cat = db.get('categories')
      .find(c => c.id === id && (c.user_id === userId || c.user_id === null))
      .value();
    if (!cat) {
      return res.status(404).json({ error: 'Category not found or not editable' });
    }

    const { name, color, icon } = req.body;
    const updated = {
      ...cat,
      user_id:    userId,
      name:       name  !== undefined ? name.trim() : cat.name,
      color:      color !== undefined ? color       : cat.color,
      icon:       icon  !== undefined ? icon        : cat.icon,
      updated_at: new Date().toISOString(),
    };

    db.get('categories')
      .find(c => c.id === id && (c.user_id === userId || c.user_id === null))
      .assign(updated)
      .write();
    res.json(updated);
  } catch (e) {
    console.error('categories update error', e);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id — delete a category
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const cat = db.get('categories')
      .find(c => c.id === id && (c.user_id === userId || c.user_id === null))
      .value();
    if (!cat) {
      return res.status(404).json({ error: 'Category not found or not deletable' });
    }

    db.get('categories')
      .remove(c => c.id === id && (c.user_id === userId || c.user_id === null))
      .write();

    // Preserve all existing transaction data: never delete transactions!
    // Simply unlink category reference to null on transactions belonging to this user
    db.get('transactions')
      .filter(t => t.user_id === userId && (t.category_id === id || t.categoryId === id))
      .each(t => {
        t.category_id = null;
        if (t.categoryId !== undefined) {
          t.categoryId = null;
        }
      })
      .write();

    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('categories delete error', e);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
