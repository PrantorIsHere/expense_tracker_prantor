/**
 * Loan <-> Transaction synchronisation helpers.
 *
 * Cash-flow model used everywhere in the app:
 *   Cash IN  : income, loan_taken (you borrowed), loan_received (borrower paid you back)
 *   Cash OUT : expense, loan_given (you lent),   loan_repaid   (you paid lender back)
 *   Neutral  : transfer (moves money between your own accounts)
 *
 * A loan's origin transaction is referenced by loan.transaction_id (or legacy loan.transactionId).
 * Repayment transactions carry tx.loan_id.
 */
const db = require('../config/database');

const LOAN_ORIGIN_TYPES = ['loan_given', 'loan_taken'];
const LOAN_REPAYMENT_TYPES = ['loan_received', 'loan_repaid'];

const originTxIdOf = (loan) => loan.transaction_id || loan.transactionId || null;

/** Find the loan whose origin transaction is txId */
const findLoanByOriginTx = (userId, txId) =>
  db.get('loans')
    .find(l => l.user_id === userId && (l.transaction_id === txId || l.transactionId === txId))
    .value();

/**
 * Recompute repaid_amount + status for a loan from its linked repayment transactions.
 * Forgiven loans keep their 'forgiven' status.
 */
const recomputeLoan = (userId, loanId) => {
  const loan = db.get('loans').find({ id: loanId, user_id: userId }).value();
  if (!loan) return null;

  const repayments = db.get('transactions')
    .filter(t => t.user_id === userId && t.loan_id === loanId && LOAN_REPAYMENT_TYPES.includes(t.type))
    .value();

  const repaid = repayments.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const total = parseFloat(loan.amount) || 0;

  let status = loan.status;
  if (status !== 'forgiven') {
    if (repaid <= 0) status = 'pending';
    else if (repaid + 0.0001 >= total) status = 'paid';
    else status = 'partial';
  }

  const latest = repayments
    .map(t => t.date)
    .filter(Boolean)
    .sort()
    .pop();

  const patch = {
    repaid_amount: Math.round(repaid * 100) / 100,
    status,
    repaid_date: latest || null,
    updated_at: new Date().toISOString(),
  };
  db.get('loans').find({ id: loanId, user_id: userId }).assign(patch).write();
  return { ...loan, ...patch };
};

/** Remaining (outstanding) amount on a loan */
const remainingOf = (loan) => {
  if (loan.status === 'forgiven' || loan.status === 'paid' || loan.status === 'repaid') return 0;
  return Math.max(0, (parseFloat(loan.amount) || 0) - (parseFloat(loan.repaid_amount) || 0));
};

module.exports = {
  LOAN_ORIGIN_TYPES,
  LOAN_REPAYMENT_TYPES,
  originTxIdOf,
  findLoanByOriginTx,
  recomputeLoan,
  remainingOf,
};
