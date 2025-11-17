export interface User {
  id: string;
  name: string;
  type: 'Office' | 'Friend' | 'Family' | 'Client';
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  createdAt: string;
}

export interface Transaction {
  id: string;
  voucherId: string;
  title: string;
  description?: string;
  amount: number;
  type: 'income' | 'expense' | 'loan_given' | 'loan_taken';
  categoryId: string;
  userId: string;
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
  status: 'pending' | 'repaid';
  dueDate?: string;
  repaidDate?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
}

export interface AppSettings {
  currency: string;
  numberFormat: 'english' | 'bengali';
  theme: 'light' | 'dark';
  voucherPrefix: string;
}

export interface DashboardData {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  netLoans: number;
  savingsRate: number;
}