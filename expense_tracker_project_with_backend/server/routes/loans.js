const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { recomputeLoan, remainingOf, originTxIdOf } = require('../lib/loanSync');

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
  const { allocateNextVoucherId } = require('./vouchers');
  return allocateNextVoucherId(userId, dateKey);
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

      // Loan given = you gave out money -> loan_given
      // Loan taken = you received borrowed money -> loan_taken
      const txType = type === 'given' ? 'loan_given' : 'loan_taken';
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

      // Store transaction_id on the loan
      newLoan.transaction_id = createdTx.id;
      db.get('loans').find({ id: newLoan.id }).assign({ transaction_id: createdTx.id }).write();
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
    if (['paid', 'repaid', 'forgiven'].includes(loan.status)) {
      return res.status(400).json({ error: `Loan is already ${loan.status}` });
    }

    const repayAmount = amount !== undefined && amount !== '' ? parseFloat(amount) : remainingOf(loan);
    if (!repayAmount || repayAmount <= 0) {
      return res.status(400).json({ error: 'Repayment amount must be greater than 0' });
    }

    const now = new Date().toISOString();
    const repayDate = date || now;

    // 1. Generate sequential voucher ID
    const voucherId = generateNextVoucherId(userId, repayDate);

    // 2. Transaction direction:
    // If loan.type === 'given' (you lent money): borrower returns money -> cash in  -> loan_received (balance +)
    // If loan.type === 'taken' (you borrowed money): you pay lender back -> cash out -> loan_repaid  (balance -)
    // These are NOT income/expense, so reports are not inflated by loan movements.
    const isGiven = loan.type === 'given';
    const txType = isGiven ? 'loan_received' : 'loan_repaid';
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

    // 5. Create transaction record (linked to the loan)
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
      loan_id:           loan.id,
      date:              repayDate,
      created_at:        now,
      updated_at:        now,
    };
    db.get('transactions').push(newTx).write();

    // 6. Update loan status from all linked repayments
    db.get('loans').find({ id, user_id: userId }).assign({ repaid_account_id: targetAccountId }).write();
    const updatedLoan = recomputeLoan(userId, id);

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

// POST /api/loans/:id/forgive — forgive/walk over loan, remove from active loans & convert to permanent expense
router.post('/:id/forgive', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const loan = db.get('loans').find({ id, user_id: userId }).value();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    if (['forgiven', 'paid', 'repaid'].includes(loan.status)) {
      return res.status(400).json({ error: `Loan is already marked as ${loan.status}` });
    }
    if (loan.type !== 'given') {
      return res.status(400).json({ error: 'Only loans you have given can be forgiven' });
    }

    const { category_id, date, notes } = req.body;
    const now = new Date().toISOString();
    const forgiveDate = date || now;

    // Remaining unpaid amount to forgive
    const previousRepaid = parseFloat(loan.repaid_amount) || 0;
    const remainingAmount = Math.max(0, parseFloat(loan.amount) - previousRepaid);
    if (remainingAmount <= 0) {
      return res.status(400).json({ error: 'Loan has no remaining balance to forgive' });
    }

    // 1. Find or create 'Loan Forgiven' category
    let category = null;
    if (category_id) {
      category = db.get('categories').find({ id: category_id }).value();
    }
    if (!category) {
      category = db.get('categories')
        .find(c => (c.user_id === userId || c.user_id === null) && (c.name.toLowerCase() === 'loan forgiven' || c.name.toLowerCase() === 'bad debt'))
        .value();
    }
    if (!category) {
      category = {
        id: uuidv4(),
        user_id: userId,
        name: 'Loan Forgiven',
        color: '#EF4444',
        icon: 'heart-handshake',
        created_at: now,
        updated_at: now,
      };
      db.get('categories').push(category).write();
    }

    const personName = loan.person || 'Contact';

    // 2. Check if a transaction for this loan already exists
    const existingTx = db.get('transactions')
      .find(t => t.user_id === userId && (t.id === loan.transaction_id || t.id === loan.transactionId || t.id === loan.id))
      .value();

    let txRecord = null;
    if (existingTx && previousRepaid <= 0) {
      // Nothing repaid: convert the whole original loan transaction into a permanent expense.
      // Cash already left the account when the loan was given, so balance is unchanged.
      const updatedTx = {
        ...existingTx,
        title:       `Loan Forgiven - ${personName}`,
        type:        'expense',
        category_id: category.id,
        forgiven_loan_id: loan.id,
        description: notes || (existingTx.description ? `${existingTx.description} (Forgiven / Walked Over)` : 'Loan forgiven / walked over'),
        updated_at:  now,
      };
      db.get('transactions').find({ id: existingTx.id }).assign(updatedTx).write();
      txRecord = updatedTx;
    } else if (existingTx) {
      // Partially repaid: split the original transaction.
      //  - original keeps the repaid part as a loan movement
      //  - a new expense holds the forgiven remainder (same account & date, so balance is unchanged)
      db.get('transactions').find({ id: existingTx.id }).assign({
        amount: Math.round(previousRepaid * 100) / 100,
        updated_at: now,
      }).write();

      txRecord = {
        id:                uuidv4(),
        user_id:           userId,
        voucher_id:        generateNextVoucherId(userId, forgiveDate),
        title:             `Loan Forgiven - ${personName}`,
        description:       notes || 'Loan forgiven / walked over (unpaid remainder)',
        amount:            remainingAmount,
        type:              'expense',
        category_id:       category.id,
        financial_user_id: existingTx.financial_user_id || null,
        account_id:        existingTx.account_id || null,
        forgiven_loan_id:  loan.id,
        date:              existingTx.date || forgiveDate,
        created_at:        now,
        updated_at:        now,
      };
      db.get('transactions').push(txRecord).write();
    } else {
      // No origin transaction was ever recorded: the money is now permanently gone -> expense
      const voucherId = generateNextVoucherId(userId, forgiveDate);
      let finUser = db.get('financial_users')
        .find(u => u.user_id === userId && (u.id === loan.userId || (u.name && u.name.toLowerCase() === personName.toLowerCase())))
        .value();

      txRecord = {
        id:                uuidv4(),
        user_id:           userId,
        voucher_id:        voucherId,
        title:             `Loan Forgiven - ${personName}`,
        description:       notes || 'Loan forgiven / walked over',
        amount:            remainingAmount,
        type:              'expense',
        category_id:       category.id,
        financial_user_id: finUser ? finUser.id : (loan.userId || null),
        account_id:        loan.account_id || null,
        forgiven_loan_id:  loan.id,
        date:              forgiveDate,
        created_at:        now,
        updated_at:        now,
      };
      db.get('transactions').push(txRecord).write();
    }

    // 3. Update loan status to 'forgiven'
    const updatedLoan = {
      ...loan,
      status:          'forgiven',
      forgiven_amount: remainingAmount,
      forgiven_date:   forgiveDate,
      updated_at:      now,
    };
    db.get('loans').find({ id, user_id: userId }).assign(updatedLoan).write();

    res.json({
      success: true,
      loan: updatedLoan,
      transaction: txRecord,
      message: `Loan to ${personName} has been forgiven and recorded as a permanent expense.`
    });
  } catch (e) {
    console.error('forgive loan error', e);
    res.status(500).json({ error: 'Failed to forgive loan' });
  }
});

// PUT /api/loans/:id — update a loan (keeps the linked origin transaction in sync)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const loan = db.get('loans').find({ id, user_id: userId }).value();
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
    db.get('loans').find({ id, user_id: userId }).assign(updated).write();

    // Keep the origin transaction (cash out/in when loan was made) in sync
    const originId = originTxIdOf(loan);
    if (originId) {
      const originTx = db.get('transactions').find({ id: originId, user_id: userId }).value();
      if (originTx && (originTx.type === 'loan_given' || originTx.type === 'loan_taken')) {
        db.get('transactions').find({ id: originId, user_id: userId }).assign({
          amount: updated.amount,
          type:   updated.type === 'taken' ? 'loan_taken' : 'loan_given',
          date:   date ? date : originTx.date,
          updated_at: updated.updated_at,
        }).write();
      }
    }

    // Re-derive status from real repayments (unless forgiven)
    const finalLoan = updated.status === 'forgiven' ? updated : (recomputeLoan(userId, id) || updated);
    res.json(finalLoan);
  } catch (e) {
    console.error('update loan error', e);
    res.status(500).json({ error: 'Failed to update loan' });
  }
});

// DELETE /api/loans/:id
// By default also removes the loan's linked transactions (origin, repayments, forgiveness)
// so account balances and totals stay consistent. Pass ?keep_transactions=1 to keep them.
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const loan = db.get('loans').find({ id, user_id: userId }).value();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    let removedTransactions = 0;
    if (req.query.keep_transactions !== '1') {
      const originId = originTxIdOf(loan);
      const linked = db.get('transactions')
        .filter(t => t.user_id === userId && (
          (originId && t.id === originId) ||
          t.loan_id === id ||
          t.forgiven_loan_id === id
        ))
        .value();
      removedTransactions = linked.length;
      const ids = new Set(linked.map(t => t.id));
      db.get('transactions').remove(t => t.user_id === userId && ids.has(t.id)).write();
    }

    db.get('loans').remove({ id, user_id: userId }).write();
    res.json({ message: 'Deleted', removedTransactions });
  } catch (e) {
    console.error('delete loan error', e);
    res.status(500).json({ error: 'Failed to delete loan' });
  }
});

module.exports = router;
