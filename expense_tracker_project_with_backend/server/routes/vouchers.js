const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/vouchers/next
 * Returns the next sequential voucher ID for today (Dhaka timezone).
 * Format: YYYY-MM-DD-NNNN  (e.g. 2026-07-18-0001)
 */
router.post('/next', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Get current date in Dhaka time (UTC+6)
    const now = new Date();
    const dhakaOffset = 6 * 60; // minutes
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const dhakaDate = new Date(utcMs + dhakaOffset * 60000);
    const year  = dhakaDate.getFullYear();
    const month = String(dhakaDate.getMonth() + 1).padStart(2, '0');
    const day   = String(dhakaDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    // Find or create counter record for this user + date
    let counterRow = db.get('voucher_counters').find({ user_id: userId, date_key: dateKey }).value();

    if (!counterRow) {
      counterRow = { user_id: userId, date_key: dateKey, counter: 0 };
      db.get('voucher_counters').push(counterRow).write();
    }

    const newCounter = counterRow.counter + 1;
    db.get('voucher_counters').find({ user_id: userId, date_key: dateKey }).assign({ counter: newCounter }).write();

    const voucherId = `${dateKey}-${String(newCounter).padStart(4, '0')}`;
    res.json({ voucher_id: voucherId });
  } catch (e) {
    console.error('voucher next error', e);
    res.status(500).json({ error: 'Failed to generate voucher ID' });
  }
});

module.exports = router;
