const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper to calculate an account's dynamic current balance
const calculateAccountBalance = (account, userTxs) => {
  const initial = parseFloat(account.initial_balance) || 0;
  let txSum = 0;

  for (const t of userTxs) {
    const accId = t.account_id || t.accountId;
    if (accId === account.id) {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income' || t.type === 'loan_taken') {
        txSum += amt;
      } else if (t.type === 'expense' || t.type === 'loan_given') {
        txSum -= amt;
      }
    }
  }

  return initial + txSum;
};

// GET /api/accounts — get all accounts with live calculated balances for current user
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Ensure accounts collection exists in lowdb
    if (!db.has('accounts').value()) {
      db.set('accounts', []).write();
    }

    let accounts = db.get('accounts')
      .filter({ user_id: userId })
      .sortBy('created_at')
      .value();

    // If user has no accounts yet, auto-create a starter "Cash" account
    if (accounts.length === 0) {
      const now = new Date().toISOString();
      const defaultCash = {
        id:              uuidv4(),
        user_id:         userId,
        name:            'Cash',
        type:            'cash',
        account_number:  null,
        initial_balance: 0,
        color:           '#10B981',
        icon:            '💵',
        created_at:      now,
        updated_at:      now,
      };
      db.get('accounts').push(defaultCash).write();
      accounts = [defaultCash];
    }

    const userTxs = db.get('transactions')
      .filter({ user_id: userId })
      .value();

    const result = accounts.map(acc => ({
      ...acc,
      current_balance: calculateAccountBalance(acc, userTxs),
    }));

    res.json(result);
  } catch (e) {
    console.error('get accounts error', e);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// POST /api/accounts — create a new account
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, type, account_number, initial_balance, color, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Account name is required' });
    }

    const userId = req.user.id;

    // Check for duplicate account name for this user
    const duplicate = db.get('accounts')
      .find(a => a.user_id === userId && a.name.toLowerCase() === name.trim().toLowerCase())
      .value();
    if (duplicate) {
      return res.status(409).json({ error: 'An account with this name already exists' });
    }

    const now = new Date().toISOString();
    const initial = initial_balance !== undefined && initial_balance !== '' ? parseFloat(initial_balance) || 0 : 0;
    
    // Choose sensible default icons per type
    const defaultIcons = {
      cash:          '💵',
      bank:          '🏦',
      mobile_wallet: '📱',
      credit_card:   '💳',
      savings:       '🐖',
      other:         '💼',
    };
    const accType = type || 'bank';
    const accIcon = icon || defaultIcons[accType] || '🏦';

    const newAcc = {
      id:              uuidv4(),
      user_id:         userId,
      name:            name.trim(),
      type:            accType,
      account_number:  account_number ? String(account_number).trim() : null,
      initial_balance: initial,
      color:           color || '#4ECDC4',
      icon:            accIcon,
      created_at:      now,
      updated_at:      now,
    };

    db.get('accounts').push(newAcc).write();

    res.status(201).json({
      ...newAcc,
      current_balance: initial,
    });
  } catch (e) {
    console.error('create account error', e);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PUT /api/accounts/:id — update an account
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const acc = db.get('accounts').find({ id, user_id: userId }).value();
    if (!acc) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { name, type, account_number, initial_balance, color, icon } = req.body;
    
    // Check duplicate name if name changed
    if (name && name.trim().toLowerCase() !== acc.name.toLowerCase()) {
      const duplicate = db.get('accounts')
        .find(a => a.user_id === userId && a.id !== id && a.name.toLowerCase() === name.trim().toLowerCase())
        .value();
      if (duplicate) {
        return res.status(409).json({ error: 'Another account already uses this name' });
      }
    }

    const updated = {
      ...acc,
      name:            name            !== undefined ? name.trim() : acc.name,
      type:            type            !== undefined ? type        : acc.type,
      account_number:  account_number  !== undefined ? (account_number ? String(account_number).trim() : null) : acc.account_number,
      initial_balance: initial_balance !== undefined ? parseFloat(initial_balance) || 0 : acc.initial_balance,
      color:           color           !== undefined ? color       : acc.color,
      icon:            icon            !== undefined ? icon        : acc.icon,
      updated_at:      new Date().toISOString(),
    };

    db.get('accounts').find({ id, user_id: userId }).assign(updated).write();

    // Recalculate live balance
    const userTxs = db.get('transactions').filter({ user_id: userId }).value();
    const current_balance = calculateAccountBalance(updated, userTxs);

    res.json({ ...updated, current_balance });
  } catch (e) {
    console.error('update account error', e);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// DELETE /api/accounts/:id — delete an account safely
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const acc = db.get('accounts').find({ id, user_id: userId }).value();
    if (!acc) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Remove the account
    db.get('accounts').remove({ id, user_id: userId }).write();

    // Safely unlink transactions — NEVER delete user transactions!
    db.get('transactions')
      .filter(t => t.user_id === userId && (t.account_id === id || t.accountId === id))
      .each(t => {
        t.account_id = null;
        if (t.accountId !== undefined) {
          t.accountId = null;
        }
      })
      .write();

    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('delete account error', e);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;

