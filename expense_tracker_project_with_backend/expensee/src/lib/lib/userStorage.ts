import { Transaction, User, Category, Loan, Goal } from '@/types';
import { getCurrentSession, isAdmin } from './auth';

// Get user-specific storage key
const getUserStorageKey = (baseKey: string, userId?: string): string => {
  const session = getCurrentSession();
  const currentUserId = userId || session?.userId;
  
  if (!currentUserId) {
    throw new Error('No authenticated user found');
  }
  
  return `${baseKey}_${currentUserId}`;
};

// Generic user-specific storage functions
export const getUserData = <T>(baseKey: string, defaultValue: T, userId?: string): T => {
  try {
    const key = getUserStorageKey(baseKey, userId);
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading user data for ${baseKey}:`, error);
    return defaultValue;
  }
};

export const saveUserData = <T>(baseKey: string, data: T, userId?: string): void => {
  try {
    const key = getUserStorageKey(baseKey, userId);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving user data for ${baseKey}:`, error);
  }
};

// User-specific data access functions
export const getUserTransactions = (userId?: string): Transaction[] => 
  getUserData('expense_tracker_transactions', [], userId);

export const saveUserTransactions = (transactions: Transaction[], userId?: string): void => 
  saveUserData('expense_tracker_transactions', transactions, userId);

export const getUserFinancialUsers = (userId?: string): User[] => 
  getUserData('expense_tracker_users', [], userId);

export const saveUserFinancialUsers = (users: User[], userId?: string): void => 
  saveUserData('expense_tracker_users', users, userId);

export const getUserCategories = (userId?: string): Category[] => 
  getUserData('expense_tracker_categories', [], userId);

export const saveUserCategories = (categories: Category[], userId?: string): void => 
  saveUserData('expense_tracker_categories', categories, userId);

export const getUserLoans = (userId?: string): Loan[] => 
  getUserData('expense_tracker_loans', [], userId);

export const saveUserLoans = (loans: Loan[], userId?: string): void => 
  saveUserData('expense_tracker_loans', loans, userId);

export const getUserGoals = (userId?: string): Goal[] => 
  getUserData('expense_tracker_goals', [], userId);

export const saveUserGoals = (goals: Goal[], userId?: string): void => 
  saveUserData('expense_tracker_goals', goals, userId);

// Settings interface
interface AppSettings {
  currency: string;
  dateFormat: string;
  theme: string;
  notifications: boolean;
  autoBackup: boolean;
}

const defaultSettings: AppSettings = {
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  theme: 'light',
  notifications: true,
  autoBackup: false
};

export const getUserSettings = (userId?: string): AppSettings => 
  getUserData('expense_tracker_settings', defaultSettings, userId);

export const saveUserSettings = (settings: AppSettings, userId?: string): void => 
  saveUserData('expense_tracker_settings', settings, userId);

// Admin functions to get all users' data
export const getAllUsersTransactions = (): { userId: string; transactions: Transaction[] }[] => {
  if (!isAdmin()) {
    throw new Error('Admin access required');
  }
  
  const result: { userId: string; transactions: Transaction[] }[] = [];
  
  // Get all storage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('expense_tracker_transactions_')) {
      const userId = key.replace('expense_tracker_transactions_', '');
      const transactions = getUserTransactions(userId);
      result.push({ userId, transactions });
    }
  }
  
  return result;
};

// Voucher ID generation (user-specific)
export const generateUserVoucherId = (userId?: string): string => {
  const session = getCurrentSession();
  const currentUserId = userId || session?.userId;
  
  if (!currentUserId) {
    throw new Error('No authenticated user found');
  }
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const counterKey = `expense_tracker_voucher_counter_${currentUserId}`;
  const counter = JSON.parse(localStorage.getItem(counterKey) || '{}');
  const todayCounter = counter[dateStr] || 0;
  const newCounter = todayCounter + 1;
  
  counter[dateStr] = newCounter;
  localStorage.setItem(counterKey, JSON.stringify(counter));
  
  return `${dateStr}-${newCounter.toString().padStart(4, '0')}`;
};

// Export user data
export const exportUserData = (userId?: string) => {
  const session = getCurrentSession();
  const currentUserId = userId || session?.userId;
  
  if (!currentUserId) {
    throw new Error('No authenticated user found');
  }
  
  const data = {
    userId: currentUserId,
    transactions: getUserTransactions(currentUserId),
    financialUsers: getUserFinancialUsers(currentUserId),
    categories: getUserCategories(currentUserId),
    loans: getUserLoans(currentUserId),
    goals: getUserGoals(currentUserId),
    settings: getUserSettings(currentUserId),
    exportDate: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expense-tracker-backup-${currentUserId}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// Import user data
export const importUserData = (file: File, userId?: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.transactions) saveUserTransactions(data.transactions, userId);
        if (data.financialUsers) saveUserFinancialUsers(data.financialUsers, userId);
        if (data.categories) saveUserCategories(data.categories, userId);
        if (data.loans) saveUserLoans(data.loans, userId);
        if (data.goals) saveUserGoals(data.goals, userId);
        if (data.settings) saveUserSettings(data.settings, userId);
        
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
};

// Reset user data
export const resetUserData = (userId?: string): void => {
  const session = getCurrentSession();
  const currentUserId = userId || session?.userId;
  
  if (!currentUserId) {
    throw new Error('No authenticated user found');
  }
  
  const keysToRemove = [
    `expense_tracker_transactions_${currentUserId}`,
    `expense_tracker_users_${currentUserId}`,
    `expense_tracker_categories_${currentUserId}`,
    `expense_tracker_loans_${currentUserId}`,
    `expense_tracker_goals_${currentUserId}`,
    `expense_tracker_settings_${currentUserId}`,
    `expense_tracker_voucher_counter_${currentUserId}`
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
};