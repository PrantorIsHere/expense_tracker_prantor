const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/loans — all loans for current user
router.get('/', authenticateToken, (req, res) => {
  try {
    const loans = db.get('loans')
      .filter({ user_id: req.user.id })
      .value()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(loans);
  } catch (e) {
    console.error('get loans error', e);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// Helper to generate next sequential voucher ID
const generateNextVoucherId = (userId, dateInput) => {
  const dhakaOffset = 6 * 60; // minutes
  const nowUtc = new Date(dateInput || new Date().toISOString());
  const utcMs = nowUtc.getTime() + nowUtc.getTimezoneOffset() * 60000;
  const dhakaDate = new Date(utcMs + dhakaOffset * 60000);
  const year = dhakaDate.getFullYear();
  const month = String(dhakaDate.getMonth() + 1).padStart(2, '0');
  const day = String(dhakaDate.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  let counterRow = db.get('voucher_counters').find({ user_id: userId, date_key: dateKey }).value();
  if (!counterRow) {
    counterRow = { user_id: userId, date_key: dateKey, counter: 0 };
    db.get('voucher_counters').push(counterRow).write();
  }
  const newCounter = counterRow.counter + 1;
  db.get('voucher_counters').find({ user_id: userId, date_key: dateKey }).assign({ counter: newCounter }).write();

  return `${dateKey}-${String(newCounter).padStart(4, '0')}`;
};

// POST /api/loans — create a loan (with optional initial account transaction)
router.post('/', authenticateToken, (req, res) => {
  try {
    const { person, amount, type, description, date, due_date, status, account_id, record_transaction, financial_user_id } = req.body;
    if (!person || amount === undefined || !type || !date) {
      return res.status(400).json({ error: 'person, amount, type, date are required' });
    }
    const userId = req.user.id;
    const now = new Date().toISOString();
    const loanAmount = parseFloat(amount);

    const newLoan = {
      id:          uuidv4(),
      user_id:     userId,
      person,
      amount:      loanAmount,
      type,         // 'given' | 'taken'
      description: description || null,
      date,
      due_date:    due_date || null,
      status:      status || 'pending', // 'pending' | 'paid' | 'partial'
      account_id:  account_id || null,
      created_at:  now,
      updated_at:  now,
    };
    db.get('loans').push(newLoan).write();

    let createdTx = null;
    if (record_transaction && account_id) {
      const voucherId = generateNextVoucherId(userId, date);

      // Loan given = you gave out money -> expense
      // Loan taken = you received borrowed money -> income
      const txType = type === 'given' ? 'expense' : 'income';
      const txTitle = type === 'given' 
        ? `Loan Given to ${person}` 
        : `Loan Taken from ${person}`;

      let category = db.get('categories')
        .find(c => (c.user_id === userId || c.user_id === null) && c.name.toLowerCase() === 'loan')
        .value();

      if (!category) {
        category = {
          id: uuidv4(),
          user_id: userId,
          name: 'Loan',
          color: '#8B5CF6',
          icon: 'landmark',
          created_at: now,
          updated_at: now,
        };
        db.get('categories').push(category).write();
      }

      let finUser = db.get('financial_users')
        .find(u => u.user_id === userId && (u.id === financial_user_id || (u.name && u.name.toLowerCase() === person.toLowerCase())))
        .value();

      createdTx = {
        id:                uuidv4(),
        user_id:           userId,
        voucher_id:        voucherId,
        title:             txTitle,
        description:       description || null,
        amount:            loanAmount,
        type:              txType,
        category_id:       category.id,
        financial_user_id: finUser ? finUser.id : (financial_user_id || null),
        account_id:        account_id,
        date:              date || now,
        created_at:        now,
        updated_at:        now,
      };
      db.get('transactions').push(createdTx).write();
    }

    res.status(201).json({ ...newLoan, transaction: createdTx });
  } catch (e) {
    console.error('create loan error', e);
    res.status(500).json({ error: 'Failed to create loan' });
  }
});

// POST /api/loans/:id/repay — record loan repayment with account & transaction creation
router.post('/:id/repay', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { account_id, amount, date, notes } = req.body;

    const loan = db.get('loans').find({ id, user_id: userId }).value();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const repayAmount = amount !== undefined && amount !== '' ? parseFloat(amount) : parseFloat(loan.amount);
    if (!repayAmount || repayAmount <= 0) {
      return res.status(400).json({ error: 'Repayment amount must be greater than 0' });
    }

    const now = new Date().toISOString();
    const repayDate = date || now;

    // 1. Generate sequential voucher ID
    const voucherId = generateNextVoucherId(userId, repayDate);

    // 2. Transaction direction:
    // If loan.type === 'given' (you lent money): borrower returns money -> cash in -> income (balance +)
    // If loan.type === 'taken' (you borrowed money): you pay lender back -> cash out -> expense (balance -)
    const isGiven = loan.type === 'given';
    const txType = isGiven ? 'income' : 'expense';
    const personName = loan.person || 'Contact';
    const txTitle = isGiven 
      ? `Loan Repayment from ${personName}`
      : `Loan Repayment to ${personName}`;

    // 3. Category for Loan Repayment
    let category = db.get('categories')
      .find(c => (c.user_id === userId || c.user_id === null) && (c.name.toLowerCase() === 'loan repayment' || c.name.toLowerCase() === 'loan'))
      .value();

    if (!category) {
      category = {
        id: uuidv4(),
        user_id: userId,
        name: 'Loan Repayment',
        color: '#3B82F6',
        icon: 'hand-coins',
        created_at: now,
        updated_at: now,
      };
      db.get('categories').push(category).write();
    }

    // 4. Financial user resolution
    let finUser = db.get('financial_users')
      .find(u => u.user_id === userId && (u.id === loan.userId || (u.name && u.name.toLowerCase() === personName.toLowerCase())))
      .value();

    // 5. Create transaction record
    const targetAccountId = account_id || loan.account_id || null;
    const newTx = {
      id:                uuidv4(),
      user_id:           userId,
      voucher_id:        voucherId,
      title:             txTitle,
      description:       notes || (loan.description ? `Ref loan: ${loan.description}` : null),
      amount:            repayAmount,
      type:              txType,
      category_id:       category.id,
      financial_user_id: finUser ? finUser.id : (loan.userId || null),
      account_id:        targetAccountId,
      date:              repayDate,
      created_at:        now,
      updated_at:        now,
    };
    db.get('transactions').push(newTx).write();

    // 6. Update loan status
    const previousRepaid = parseFloat(loan.repaid_amount) || 0;
    const totalRepaidSoFar = previousRepaid + repayAmount;
    const isFullyPaid = totalRepaidSoFar >= parseFloat(loan.amount);

    const updatedLoan = {
      ...loan,
      status:            isFullyPaid ? 'paid' : 'partial',
      repaid_amount:     totalRepaidSoFar,
      repaid_date:       repayDate,
      repaid_account_id: targetAccountId,
      updated_at:        now,
    };
    db.get('loans').find({ id, user_id: userId }).assign(updatedLoan).write();

    res.json({
      success: true,
      loan: updatedLoan,
      transaction: newTx,
      message: `Loan recorded as ${updatedLoan.status} with transaction created.`
    });
  } catch (e) {
    console.error('repay loan error', e);
    res.status(500).json({ error: 'Failed to record loan repayment' });
  }
});

// PUT /api/loans/:id — update a loan
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const loan = db.get('loans').find({ id, user_id: req.user.id }).value();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const { person, amount, type, description, date, due_date, status } = req.body;
    const updated = {
      ...loan,
      person:      person      ?? loan.person,
      amount:      amount !== undefined ? parseFloat(amount) : loan.amount,
      type:        type        ?? loan.type,
      description: description !== undefined ? description : loan.description,
      date:        date        ?? loan.date,
      due_date:    due_date    !== undefined ? due_date : loan.due_date,
      status:      status      ?? loan.status,
      updated_at:  new Date().toISOString(),
    };
    db.get('loans').find({ id, user_id: req.user.id }).assign(updated).write();
    res.json(updated);
  } catch (e) {
    console.error('update loan error', e);
    res.status(500).json({ error: 'Failed to update loan' });
  }
});

// DELETE /api/loans/:id
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const loan = db.get('loans').find({ id, user_id: req.user.id }).value();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    db.get('loans').remove({ id, user_id: req.user.id }).write();
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('delete loan error', e);
    res.status(500).json({ error: 'Failed to delete loan' });
  }
});

module.exports = router;
