const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { findLoanByOriginTx, recomputeLoan, LOAN_ORIGIN_TYPES } = require('../lib/loanSync');
const { allocateNextVoucherId } = require('./vouchers');

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

    // Check voucher_id uniqueness scoped to this user; if auto-generated pattern collides, allocate next available
    let finalVoucherId = voucher_id;
    const duplicate = db.get('transactions').find({ user_id: req.user.id, voucher_id: finalVoucherId }).value();
    if (duplicate) {
      const m = String(finalVoucherId).match(/^(\d{4}-\d{2}-\d{2})-\d+$/);
      if (m) {
        finalVoucherId = allocateNextVoucherId(req.user.id, m[1]);
      } else {
        return res.status(400).json({ error: 'Voucher ID already exists' });
      }
    }

    const now = new Date().toISOString();
    const targetAccountId = account_id || accountId || null;
    const targetToAccountId = to_account_id || toAccountId || null;
    const newTx = {
      id:                uuidv4(),
      user_id:           req.user.id,
      voucher_id:        finalVoucherId,
      title,
      description:       description || null,
      amount:            parseFloat(amount),
      type,
      category_id:       category_id || null,
      financial_user_id: financial_user_id || null,
      account_id:        targetAccountId,
      to_account_id:     targetToAccountId,
      loan_id:           req.body.loan_id || null,
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

    // ---- Keep loans in sync ----
    const originLoan = findLoanByOriginTx(userId, id);
    const wasLoanOrigin = LOAN_ORIGIN_TYPES.includes(tx.type);
    const isLoanOrigin = LOAN_ORIGIN_TYPES.includes(updated.type);

    if (originLoan && isLoanOrigin) {
      // Loan origin edited -> mirror amount/type/date/account on the loan
      db.get('loans').find({ id: originLoan.id, user_id: userId }).assign({
        amount:     updated.amount,
        type:       updated.type === 'loan_taken' ? 'taken' : 'given',
        date:       updated.date,
        account_id: updated.account_id,
        updated_at: updated.updated_at,
      }).write();
      recomputeLoan(userId, originLoan.id);
    } else if (originLoan && wasLoanOrigin && !isLoanOrigin) {
      // Re-classified away from a loan -> it is no longer a loan
      const hasRepayments = db.get('transactions').some(t => t.user_id === userId && t.loan_id === originLoan.id).value();
      if (hasRepayments) {
        db.get('loans').find({ id: originLoan.id, user_id: userId }).assign({ transaction_id: null, transactionId: null }).write();
      } else {
        db.get('loans').remove({ id: originLoan.id, user_id: userId }).write();
      }
    } else if (!originLoan && !wasLoanOrigin && isLoanOrigin) {
      // Re-classified into a loan -> create the loan record
      let personName = 'Contact';
      if (updated.financial_user_id) {
        const u = db.get('financial_users').find({ id: updated.financial_user_id, user_id: userId }).value();
        if (u && u.name) personName = u.name;
      }
      db.get('loans').push({
        id:             uuidv4(),
        user_id:        userId,
        transaction_id: id,
        person:         personName,
        amount:         updated.amount,
        type:           updated.type === 'loan_given' ? 'given' : 'taken',
        description:    updated.title,
        date:           updated.date,
        due_date:       null,
        status:         'pending',
        account_id:     updated.account_id,
        created_at:     updated.updated_at,
        updated_at:     updated.updated_at,
      }).write();
    }

    // Repayment edited -> recompute the loan's repaid amount/status
    if (tx.loan_id) recomputeLoan(userId, tx.loan_id);

    res.json(updated);
  } catch (e) {
    console.error('update transaction error', e);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// DELETE /api/transactions/:id
// If the transaction is a loan's origin, the loan and its repayments are removed too.
// If it is a repayment, the loan's repaid amount/status is recalculated.
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const tx = db.get('transactions').find({ id, user_id: userId }).value();
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    db.get('transactions').remove({ id, user_id: userId }).write();

    let removedLoan = null;
    let removedRepayments = 0;
    const originLoan = findLoanByOriginTx(userId, id);
    if (originLoan) {
      const repayments = db.get('transactions').filter(t => t.user_id === userId && t.loan_id === originLoan.id).value();
      removedRepayments = repayments.length;
      db.get('transactions').remove(t => t.user_id === userId && t.loan_id === originLoan.id).write();
      db.get('loans').remove({ id: originLoan.id, user_id: userId }).write();
      removedLoan = originLoan.id;
    }

    if (tx.loan_id) recomputeLoan(userId, tx.loan_id);

    res.json({ message: 'Deleted', removedLoan, removedRepayments });
  } catch (e) {
    console.error('delete transaction error', e);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;
