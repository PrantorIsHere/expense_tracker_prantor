const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions — all transactions for current user, with category info
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = db.get('transactions')
      .filter({ user_id: userId })
      .value()
      .map(t => {
        const category = t.category_id
          ? db.get('categories').find({ id: t.category_id }).value()
          : null;
        const accId = t.account_id || t.accountId;
        const account = accId && db.has('accounts').value()
          ? db.get('accounts').find({ id: accId }).value()
          : null;
        const toAccId = t.to_account_id || t.toAccountId;
        const toAccount = toAccId && db.has('accounts').value()
          ? db.get('accounts').find({ id: toAccId }).value()
          : null;
        return {
          ...t,
          category_name:   category ? category.name  : null,
          category_color:  category ? category.color : null,
          account_id:      accId || null,
          account_name:    account ? account.name : null,
          account_type:    account ? account.type : null,
          to_account_id:   toAccId || null,
          to_account_name: toAccount ? toAccount.name : null,
        };
      })
      .sort((a, b) => {
        // Sort by date DESC, then created_at DESC
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.created_at.localeCompare(a.created_at);
      });

    res.json(transactions);
  } catch (e) {
    console.error('get transactions error', e);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/transactions — create a new transaction
router.post('/', authenticateToken, (req, res) => {
  try {
    const { 
      voucher_id, 
      title, 
      description, 
      amount, 
      type, 
      category_id, 
      financial_user_id, 
      account_id, 
      accountId, 
      to_account_id, 
      toAccountId, 
      date 
    } = req.body;

    if (!voucher_id || !title || !amount || !type || !date) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Check voucher_id uniqueness
    const duplicate = db.get('transactions').find({ voucher_id }).value();
    if (duplicate) {
      return res.status(400).json({ error: 'Voucher ID already exists' });
    }

    const now = new Date().toISOString();
    const targetAccountId = account_id || accountId || null;
    const targetToAccountId = to_account_id || toAccountId || null;
    const newTx = {
      id:                uuidv4(),
      user_id:           req.user.id,
      voucher_id,
      title,
      description:       description || null,
      amount:            parseFloat(amount),
      type,
      category_id:       category_id || null,
      financial_user_id: financial_user_id || null,
      account_id:        targetAccountId,
      to_account_id:     targetToAccountId,
      date,
      created_at:        now,
      updated_at:        now,
    };

    db.get('transactions').push(newTx).write();

    // If transaction is loan_given or loan_taken, automatically sync with loans collection
    if ((type === 'loan_given' || type === 'loan_taken') && !req.body.skip_loan_sync) {
      let personName = 'Contact';
      if (financial_user_id) {
        const u = db.get('financial_users').find({ id: financial_user_id, user_id: req.user.id }).value();
        if (u && u.name) personName = u.name;
      }
      const newLoan = {
        id:             uuidv4(),
        user_id:        req.user.id,
        transaction_id: newTx.id,
        person:         personName,
        amount:         parseFloat(amount),
        type:           type === 'loan_given' ? 'given' : 'taken',
        description:    title,
        date:           date,
        due_date:       null,
        status:         'pending',
        account_id:     targetAccountId,
        created_at:     now,
        updated_at:     now,
      };
      db.get('loans').push(newLoan).write();
    }

    res.status(201).json(newTx);
  } catch (e) {
    console.error('create transaction error', e);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// PUT /api/transactions/:id — update a transaction
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, amount, type, category_id, financial_user_id, account_id, accountId, to_account_id, toAccountId, date } = req.body;

    const tx = db.get('transactions').find({ id, user_id: userId }).value();
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const targetAccountId = account_id !== undefined ? (account_id || null) : (accountId !== undefined ? (accountId || null) : tx.account_id);
    const targetToAccountId = to_account_id !== undefined ? (to_account_id || null) : (toAccountId !== undefined ? (toAccountId || null) : tx.to_account_id);

    const updated = {
      ...tx,
      title:             title            ?? tx.title,
      description:       description      ?? tx.description,
      amount:            amount !== undefined ? parseFloat(amount) : tx.amount,
      type:              type             ?? tx.type,
      category_id:       category_id      !== undefined ? (category_id || null) : tx.category_id,
      financial_user_id: financial_user_id !== undefined ? (financial_user_id || null) : tx.financial_user_id,
      account_id:        targetAccountId,
      to_account_id:     targetToAccountId,
      date:              date             ?? tx.date,
      updated_at:        new Date().toISOString(),
    };

    db.get('transactions').find({ id, user_id: userId }).assign(updated).write();
    res.json(updated);
  } catch (e) {
    console.error('update transaction error', e);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const tx = db.get('transactions').find({ id, user_id: userId }).value();
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    db.get('transactions').remove({ id, user_id: userId }).write();
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('delete transaction error', e);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;
