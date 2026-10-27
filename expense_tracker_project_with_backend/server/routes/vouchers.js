const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper: compute the next unused sequential voucher ID for (userId, dateKey)
 *Format: YYYY-MM-DD-NNNN (e.g. 2026-10-27-0001)
 */
function allocateNextVoucherId(userId, dateKey) {
  let counterRow = db.get('voucher_counters').find({ user_id: userId, date_key: dateKey }).value();
  if (!counterRow) {
    counterRow = { user_id: userId, date_key: dateKey, counter: 0 };
    db.get('voucher_counters').push(counterRow).write();
  }

  // Also inspect actual existing transactions for this user on dateKey
  const prefix = `${dateKey}-`;
  const userTxs = db.get('transactions').filter({ user_id: userId }).value() || [];
  let maxExisting = 0;
  for (const t of userTxs) {
    const vid = String(t.voucher_id || t.voucherId || '');
    if (vid.startsWith(prefix)) {
      const tail = parseInt(vid.slice(prefix.length), 10);
      if (!isNaN(tail) && tail > maxExisting) {
        maxExisting = tail;
      }
    }
  }

  // Start from maxExisting + 1 so failed attempts don't skip numbers, while never colliding
  let nextNum = Math.max(maxExisting + 1, 1);
  let voucherId = `${dateKey}-${String(nextNum).padStart(4, '0')}`;
  while (db.get('transactions').find({ user_id: userId, voucher_id: voucherId }).value()) {
    nextNum++;
    voucherId = `${dateKey}-${String(nextNum).padStart(4, '0')}`;
  }

  db.get('voucher_counters')
    .find({ user_id: userId, date_key: dateKey })
    .assign({ counter: nextNum })
    .write();

  return voucherId;
}

/**
 * POST /api/vouchers/next
 * Returns the next sequential voucher ID for today (Dhaka timezone).
 * Format: YYYY-MM-DD-NNNN  (e.g. 2026-10-27-0001)
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

    const voucherId = allocateNextVoucherId(userId, dateKey);
    res.json({ voucher_id: voucherId });
  } catch (e) {
    console.error('voucher next error', e);
    res.status(500).json({ error: 'Failed to generate voucher ID' });
  }
});

module.exports = router;
module.exports.allocateNextVoucherId = allocateNextVoucherId;
