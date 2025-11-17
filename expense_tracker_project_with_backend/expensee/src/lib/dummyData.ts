import { Transaction, User, Category, Loan, Goal } from '@/types';
import { saveTransactions, saveUsers, saveCategories, saveLoans, saveGoals } from './storage';

const dummyUsers: User[] = [
  { id: '1', name: 'Office', type: 'Office', createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', name: 'John Doe', type: 'Friend', createdAt: '2024-01-01T00:00:00Z' },
  { id: '3', name: 'Jane Smith', type: 'Family', createdAt: '2024-01-01T00:00:00Z' },
  { id: '4', name: 'ABC Corp', type: 'Client', createdAt: '2024-01-01T00:00:00Z' }
];

const dummyCategories: Category[] = [
  { id: '1', name: 'Salary', type: 'income', createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', name: 'Freelance', type: 'income', createdAt: '2024-01-01T00:00:00Z' },
  { id: '3', name: 'Food', type: 'expense', createdAt: '2024-01-01T00:00:00Z' },
  { id: '4', name: 'Travel', type: 'expense', createdAt: '2024-01-01T00:00:00Z' },
  { id: '5', name: 'Self', type: 'expense', createdAt: '2024-01-01T00:00:00Z' },
  { id: '6', name: 'Utilities', type: 'expense', createdAt: '2024-01-01T00:00:00Z' }
];

const generateDummyTransactions = (): Transaction[] => {
  const transactions: Transaction[] = [];
  const now = new Date();
  
  // Generate transactions for the last 6 months
  for (let month = 0; month < 6; month++) {
    const date = new Date(now.getFullYear(), now.getMonth() - month, 1);
    
    // Income transactions
    for (let i = 0; i < 3; i++) {
      const transactionDate = new Date(date.getFullYear(), date.getMonth(), Math.floor(Math.random() * 28) + 1);
      transactions.push({
        id: `income-${month}-${i}`,
        voucherId: `${transactionDate.toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`,
        title: i === 0 ? 'Monthly Salary' : `Freelance Project ${i}`,
        description: i === 0 ? 'Regular monthly salary' : `Project work for client`,
        amount: i === 0 ? 50000 : Math.floor(Math.random() * 20000) + 5000,
        type: 'income',
        categoryId: i === 0 ? '1' : '2',
        userId: i === 0 ? '1' : '4',
        date: transactionDate.toISOString(),
        createdAt: transactionDate.toISOString(),
        updatedAt: transactionDate.toISOString()
      });
    }
    
    // Expense transactions
    for (let i = 0; i < 8; i++) {
      const transactionDate = new Date(date.getFullYear(), date.getMonth(), Math.floor(Math.random() * 28) + 1);
      const categories = ['3', '4', '5', '6'];
      const categoryId = categories[Math.floor(Math.random() * categories.length)];
      const amounts = { '3': [500, 1500], '4': [2000, 8000], '5': [1000, 5000], '6': [3000, 7000] };
      
      transactions.push({
        id: `expense-${month}-${i}`,
        voucherId: `${transactionDate.toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 10).padStart(4, '0')}`,
        title: `${dummyCategories.find(c => c.id === categoryId)?.name} Expense`,
        description: `Monthly ${dummyCategories.find(c => c.id === categoryId)?.name.toLowerCase()} expense`,
        amount: Math.floor(Math.random() * (amounts[categoryId as keyof typeof amounts][1] - amounts[categoryId as keyof typeof amounts][0])) + amounts[categoryId as keyof typeof amounts][0],
        type: 'expense',
        categoryId,
        userId: Math.random() > 0.5 ? '1' : '3',
        date: transactionDate.toISOString(),
        createdAt: transactionDate.toISOString(),
        updatedAt: transactionDate.toISOString()
      });
    }
  }
  
  // Add some loan transactions
  const loanDate = new Date(now.getFullYear(), now.getMonth(), 15);
  transactions.push({
    id: 'loan-given-1',
    voucherId: `${loanDate.toISOString().slice(0, 10).replace(/-/g, '')}-0100`,
    title: 'Loan Given to John',
    description: 'Personal loan to friend',
    amount: 15000,
    type: 'loan_given',
    categoryId: '1',
    userId: '2',
    date: loanDate.toISOString(),
    createdAt: loanDate.toISOString(),
    updatedAt: loanDate.toISOString()
  });
  
  transactions.push({
    id: 'loan-taken-1',
    voucherId: `${loanDate.toISOString().slice(0, 10).replace(/-/g, '')}-0101`,
    title: 'Loan Taken from Bank',
    description: 'Emergency loan',
    amount: 25000,
    type: 'loan_taken',
    categoryId: '1',
    userId: '1',
    date: loanDate.toISOString(),
    createdAt: loanDate.toISOString(),
    updatedAt: loanDate.toISOString()
  });
  
  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const dummyLoans: Loan[] = [
  {
    id: '1',
    transactionId: 'loan-given-1',
    userId: '2',
    amount: 15000,
    type: 'given',
    status: 'pending',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    transactionId: 'loan-taken-1',
    userId: '1',
    amount: 25000,
    type: 'taken',
    status: 'pending',
    dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  }
];

const dummyGoals: Goal[] = [
  {
    id: '1',
    title: 'Emergency Fund',
    targetAmount: 100000,
    currentAmount: 45000,
    deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Vacation Fund',
    targetAmount: 50000,
    currentAmount: 20000,
    deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

export const initializeDummyData = () => {
  // Only initialize if no data exists
  const existingTransactions = JSON.parse(localStorage.getItem('expense_tracker_transactions') || '[]');
  if (existingTransactions.length === 0) {
    saveUsers(dummyUsers);
    saveCategories(dummyCategories);
    saveTransactions(generateDummyTransactions());
    saveLoans(dummyLoans);
    saveGoals(dummyGoals);
    console.log('Dummy data initialized');
  }
};