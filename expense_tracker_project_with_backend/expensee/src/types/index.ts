export interface User {
  id: string;
  name: string;
  type?: 'Office' | 'Friend' | 'Family' | 'Client';
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  type?: 'income' | 'expense';
  color?: string;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'mobile_wallet' | 'credit_card' | 'savings' | 'other';
  bankName?: string;
  accountNumber?: string;
  initialBalance: number;
  currentBalance?: number;
  balance?: number;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  voucherId: string;
  title: string;
  description?: string;
  amount: number;
  type: 'income' | 'expense' | 'loan_given' | 'loan_taken' | 'loan_received' | 'loan_repaid' | 'transfer';
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  userId: string;
  userName?: string;
  accountId?: string;
  accountName?: string;
  accountType?: string;
  toAccountId?: string;
  toAccountName?: string;
  loanId?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  transactionId?: string;
  transaction_id?: string;
  userId?: string;
  user_id?: string;
  person?: string;
  amount: number;
  type: 'given' | 'taken';
  status: 'pending' | 'repaid' | 'paid' | 'partial' | 'forgiven';
  dueDate?: string;
  due_date?: string;
  repaidDate?: string;
  repaid_date?: string;
  repaidAmount?: number;
  repaid_amount?: number;
  accountId?: string;
  account_id?: string;
  repaidAccountId?: string;
  repaid_account_id?: string;
  forgivenDate?: string;
  forgiven_date?: string;
  forgivenAmount?: number;
  forgiven_amount?: number;
  description?: string;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  currency: string;
  numberFormat?: 'english' | 'bengali';
  dateFormat?: string;
  theme: 'light' | 'dark' | 'system';
  voucherPrefix?: string;
  notifications?: boolean;
  autoBackup?: boolean;
  softwareName?: string;
}

export interface DashboardData {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  netLoans: number;
  savingsRate: number;
}
