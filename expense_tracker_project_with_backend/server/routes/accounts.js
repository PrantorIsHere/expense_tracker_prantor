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
    const amt = parseFloat(t.amount) || 0;
    const fromAccId = t.account_id || t.accountId;
    const toAccId = t.to_account_id || t.toAccountId;

    if (t.type === 'transfer') {
      if (fromAccId === account.id) {
        txSum -= amt; // Outflow from source account
      }
      if (toAccId === account.id) {
        txSum += amt; // Inflow to destination account
      }
    } else {
      if (fromAccId === account.id) {
        if (t.type === 'income' || t.type === 'loan_taken') {
          txSum += amt;
        } else if (t.type === 'expense' || t.type === 'loan_given') {
          txSum -= amt;
        }
      }
    }
  }

  return initial + txSum;
};

// Helper to generate sequential voucher ID in Dhaka time (V-YYYYMMDD-XXXX)
const generateNextVoucherId = (userId, dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const dhakaStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const dateKey = dhakaStr.replace(/-/g, '');

  const userTxs = db.get('transactions')
    .filter({ user_id: userId })
    .value();

  let maxNum = 0;
  const regex = new RegExp(`^V?[-_]?${dateKey}[-_](\\d+)`, 'i');
  for (const t of userTxs) {
    const vid = t.voucher_id || t.voucherId || '';
    const match = vid.match(regex);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }

  const nextSeq = String(maxNum + 1).padStart(4, '0');
  return `V-${dateKey}-${nextSeq}`;
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

// POST /api/accounts/transfer — transfer money between two accounts
router.post('/transfer', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { from_account_id, to_account_id, amount, date, notes } = req.body;

    if (!from_account_id || !to_account_id) {
      return res.status(400).json({ error: 'Both source and destination accounts are required' });
    }

    if (from_account_id === to_account_id) {
      return res.status(400).json({ error: 'Source and destination accounts must be different' });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ error: 'Transfer amount must be greater than 0' });
    }

    const fromAccount = db.get('accounts').find({ id: from_account_id, user_id: userId }).value();
    const toAccount = db.get('accounts').find({ id: to_account_id, user_id: userId }).value();

    if (!fromAccount || !toAccount) {
      return res.status(404).json({ error: 'One or both accounts could not be found' });
    }

    const now = new Date().toISOString();
    const txDate = date || now;
    const voucherId = generateNextVoucherId(userId, txDate);

    // Find or create 'Transfer' category
    let category = db.get('categories')
      .find(c => (c.user_id === userId || c.user_id === null) && c.name.toLowerCase() === 'transfer')
      .value();

    if (!category) {
      category = {
        id: uuidv4(),
        user_id: userId,
        name: 'Transfer',
        color: '#6366F1',
        icon: 'arrow-left-right',
        created_at: now,
        updated_at: now,
      };
      db.get('categories').push(category).write();
    }

    const newTx = {
      id:            uuidv4(),
      user_id:       userId,
      voucher_id:    voucherId,
      title:         `Transfer: ${fromAccount.name} → ${toAccount.name}`,
      description:   notes || `Transferred from ${fromAccount.name} to ${toAccount.name}`,
      amount:        transferAmount,
      type:          'transfer',
      category_id:   category.id,
      account_id:    from_account_id,
      to_account_id: to_account_id,
      date:          txDate,
      created_at:    now,
      updated_at:    now,
    };

    db.get('transactions').push(newTx).write();

    // Recalculate both balances
    const userTxs = db.get('transactions').filter({ user_id: userId }).value();
    const fromBalance = calculateAccountBalance(fromAccount, userTxs);
    const toBalance = calculateAccountBalance(toAccount, userTxs);

    res.status(201).json({
      success: true,
      transaction: newTx,
      from_account: { ...fromAccount, current_balance: fromBalance },
      to_account: { ...toAccount, current_balance: toBalance },
      message: `Successfully transferred ${transferAmount} from ${fromAccount.name} to ${toAccount.name}`
    });
  } catch (e) {
    console.error('transfer funds error', e);
    res.status(500).json({ error: 'Failed to process account transfer' });
  }
});

module.exports = router;


