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
  type: 'income' | 'expense' | 'loan_given' | 'loan_taken' | 'transfer';
  categoryId: string;
  userId: string;
  accountId?: string;
  accountName?: string;
  accountType?: string;
  toAccountId?: string;
  toAccountName?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  transactionId: string;
  userId: string;
  amount: number;
  type: 'given' | 'taken';
  status: 'pending' | 'repaid' | 'paid' | 'partial' | 'forgiven';
  dueDate?: string;
  repaidDate?: string;
  forgivenDate?: string;
  forgivenAmount?: number;
  createdAt: string;
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
