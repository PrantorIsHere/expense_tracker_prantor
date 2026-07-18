const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_SETTINGS = {
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  theme: 'light',
  notifications: true,
  autoBackup: false,
  softwareName: 'Expense Tracker',
};

// GET /api/settings — get settings for current user
router.get('/', authenticateToken, (req, res) => {
  try {
    const row = db.get('settings').find({ user_id: req.user.id }).value();
    if (!row) {
      // Auto-create default settings on first access
      const now = new Date().toISOString();
      const newRow = { id: uuidv4(), user_id: req.user.id, ...DEFAULT_SETTINGS, created_at: now, updated_at: now };
      db.get('settings').push(newRow).write();
      return res.json(newRow);
    }
    // Merge defaults so legacy rows (missing new fields) still return complete settings
    res.json({ ...DEFAULT_SETTINGS, ...row });
  } catch (e) {
    console.error('get settings error', e);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings — update settings for current user
router.put('/', authenticateToken, (req, res) => {
  try {
    const { currency, dateFormat, theme, notifications, autoBackup } = req.body;
    let row = db.get('settings').find({ user_id: req.user.id }).value();
    const now = new Date().toISOString();

    if (!row) {
      row = { id: uuidv4(), user_id: req.user.id, ...DEFAULT_SETTINGS, created_at: now };
      db.get('settings').push(row).write();
    }

    const updated = {
      ...row,
      currency:      currency      !== undefined ? currency      : row.currency,
      dateFormat:    dateFormat    !== undefined ? dateFormat    : row.dateFormat,
      theme:         theme         !== undefined ? theme         : row.theme,
      notifications: notifications !== undefined ? notifications : row.notifications,
      autoBackup:    autoBackup    !== undefined ? autoBackup    : row.autoBackup,
      softwareName:  req.body.softwareName !== undefined ? req.body.softwareName : row.softwareName,
      updated_at:    now,
    };

    db.get('settings').find({ user_id: req.user.id }).assign(updated).write();
    res.json(updated);
  } catch (e) {
    console.error('update settings error', e);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});


// POST /api/settings/import — replace all data for the current user
router.post('/import', authenticateToken, (req, res) => {
  try {
    const data = req.body;
    const userId = req.user.id;
    const now = new Date().toISOString();

    const collections = {
      transactions: 'transactions',
      financialUsers: 'financial_users',
      categories: 'categories',
      loans: 'loans',
      goals: 'goals',
    };

    // Helper to replace a collection for the user
    const replaceCollection = (importKey, dbKey) => {
      if (Array.isArray(data[importKey])) {
        // Remove existing items for this user
        db.get(dbKey).remove({ user_id: userId }).write();
        
        // Add new items, ensuring user_id is set
        const items = data[importKey].map(item => ({
          ...item,
          user_id: userId,
          created_at: item.created_at || now,
        }));
        
        items.forEach(item => {
          db.get(dbKey).push(item).write();
        });
      }
    };

    // Replace standard collections
    for (const [importKey, dbKey] of Object.entries(collections)) {
      replaceCollection(importKey, dbKey);
    }

    // Replace additional info collections if present
    if (data.additionalInfo) {
      if (Array.isArray(data.additionalInfo.transactionHistory)) {
        db.get('additional_info_transactions').remove({ user_id: userId }).write();
        data.additionalInfo.transactionHistory.forEach(item => {
          db.get('additional_info_transactions').push({ ...item, user_id: userId, created_at: item.created_at || now }).write();
        });
      }
      if (Array.isArray(data.additionalInfo.rentHistory)) {
        db.get('rent_history').remove({ user_id: userId }).write();
        data.additionalInfo.rentHistory.forEach(item => {
          db.get('rent_history').push({ ...item, user_id: userId, created_at: item.created_at || now }).write();
        });
      }
      if (Array.isArray(data.additionalInfo.gadgetWarranties)) {
        db.get('gadget_warranties').remove({ user_id: userId }).write();
        data.additionalInfo.gadgetWarranties.forEach(item => {
          db.get('gadget_warranties').push({ ...item, user_id: userId, created_at: item.created_at || now }).write();
        });
      }
    }

    // Replace settings
    if (data.settings) {
      let row = db.get('settings').find({ user_id: userId }).value();
      if (row) {
        db.get('settings').find({ user_id: userId }).assign({
          ...data.settings,
          user_id: userId, // Ensure user_id isn't overwritten maliciously
          updated_at: now
        }).write();
      }
    }

    res.json({ success: true, message: 'Data imported successfully' });
  } catch (error) {
    console.error('Data import error:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

module.exports = router;
