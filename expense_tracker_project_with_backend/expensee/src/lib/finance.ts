/**
 * Single source of truth for how every transaction type affects money.
 *
 *   Cash IN  : income, loan_taken (you borrowed), loan_received (borrower paid you back)
 *   Cash OUT : expense, loan_given (you lent),   loan_repaid   (you paid the lender back)
 *   Neutral  : transfer (between your own accounts)
 *
 * Income / Expense (for reports, savings, expense ratio) only use real `income` / `expense`.
 * Total Balance uses the full cash flow, so it always matches your account balances.
 */
export type TxType =
  | 'income'
  | 'expense'
  | 'loan_given'
  | 'loan_taken'
  | 'loan_received'
  | 'loan_repaid'
  | 'transfer';

export const CASH_IN_TYPES: string[] = ['income', 'loan_taken', 'loan_received'];
export const CASH_OUT_TYPES: string[] = ['expense', 'loan_given', 'loan_repaid'];
export const LOAN_TYPES: string[] = ['loan_given', 'loan_taken', 'loan_received', 'loan_repaid'];

/** +1 = money in, -1 = money out, 0 = neutral (transfer) */
export function cashSign(type: string): 1 | -1 | 0 {
  if (CASH_IN_TYPES.includes(type)) return 1;
  if (CASH_OUT_TYPES.includes(type)) return -1;
  return 0;
}

export const isLoanType = (type: string) => LOAN_TYPES.includes(type);

interface MinimalTx {
  type: string;
  amount: number;
}

export interface FinanceSummary {
  income: number;
  expense: number;
  loanGiven: number;
  loanTaken: number;
  loanReceived: number;
  loanRepaid: number;
  cashIn: number;
  cashOut: number;
  /** cashIn - cashOut: the real change in your money (matches account balances) */
  netCashFlow: number;
  /** income - expense: true savings, excluding loans and transfers */
  netSavings: number;
}

export function summarize(transactions: MinimalTx[]): FinanceSummary {
  const s: FinanceSummary = {
    income: 0, expense: 0,
    loanGiven: 0, loanTaken: 0, loanReceived: 0, loanRepaid: 0,
    cashIn: 0, cashOut: 0, netCashFlow: 0, netSavings: 0,
  };
  for (const t of transactions) {
    const amt = Number(t.amount) || 0;
    switch (t.type) {
      case 'income': s.income += amt; break;
      case 'expense': s.expense += amt; break;
      case 'loan_given': s.loanGiven += amt; break;
      case 'loan_taken': s.loanTaken += amt; break;
      case 'loan_received': s.loanReceived += amt; break;
      case 'loan_repaid': s.loanRepaid += amt; break;
    }
    const sign = cashSign(t.type);
    if (sign > 0) s.cashIn += amt;
    else if (sign < 0) s.cashOut += amt;
  }
  s.netCashFlow = s.cashIn - s.cashOut;
  s.netSavings = s.income - s.expense;
  return s;
}

/** Display metadata for each transaction type */
export const TX_TYPE_META: Record<string, { label: string; text: string; dot: string; badge: string; prefix: string }> = {
  income:        { label: 'Income',          prefix: '+',  text: 'text-green-600 dark:text-green-400',   dot: 'bg-green-500',   badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  expense:       { label: 'Expense',         prefix: '-',  text: 'text-red-600 dark:text-red-400',       dot: 'bg-red-500',     badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  loan_given:    { label: 'Loan Given',      prefix: '-',  text: 'text-amber-600 dark:text-amber-400',   dot: 'bg-amber-500',   badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  loan_taken:    { label: 'Loan Taken',      prefix: '+',  text: 'text-blue-600 dark:text-blue-400',     dot: 'bg-blue-500',    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  loan_received: { label: 'Loan Received',   prefix: '+',  text: 'text-teal-600 dark:text-teal-400',     dot: 'bg-teal-500',    badge: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30' },
  loan_repaid:   { label: 'Loan Repaid',     prefix: '-',  text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500',  badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30' },
  transfer:      { label: 'Transfer',        prefix: '⇄ ', text: 'text-indigo-600 dark:text-indigo-400', dot: 'bg-indigo-500',  badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30' },
};

export const txMeta = (type: string) =>
  TX_TYPE_META[type] || { label: type, prefix: '', text: 'text-muted-foreground', dot: 'bg-gray-400', badge: '' };

/* ---------------- Loans ---------------- */

interface MinimalLoan {
  type: string;
  amount: number;
  status?: string;
  repaid_amount?: number;
  repaidAmount?: number;
}

const SETTLED = ['paid', 'repaid', 'forgiven'];

/** Amount still owed on a loan (0 when paid / forgiven) */
export function loanRemaining(l: MinimalLoan): number {
  if (SETTLED.includes(String(l.status))) return 0;
  const repaid = Number(l.repaid_amount ?? l.repaidAmount ?? 0) || 0;
  return Math.max(0, (Number(l.amount) || 0) - repaid);
}

export const isLoanOpen = (l: MinimalLoan) => loanRemaining(l) > 0;

export function loanSummary(loans: MinimalLoan[]) {
  let outstandingGiven = 0;
  let outstandingTaken = 0;
  let openGiven = 0;
  let openTaken = 0;
  for (const l of loans) {
    const r = loanRemaining(l);
    if (r <= 0) continue;
    if (l.type === 'given') { outstandingGiven += r; openGiven++; }
    else if (l.type === 'taken') { outstandingTaken += r; openTaken++; }
  }
  return {
    outstandingGiven,
    outstandingTaken,
    netPosition: outstandingGiven - outstandingTaken,
    openGiven,
    openTaken,
  };
}
