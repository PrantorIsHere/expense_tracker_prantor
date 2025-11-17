// Updated storage.ts to use user-specific storage
export * from './userStorage';

// Keep backward compatibility by re-exporting with original names
import {
  getUserTransactions as getTransactions,
  saveUserTransactions as saveTransactions,
  getUserFinancialUsers as getUsers,
  saveUserFinancialUsers as saveUsers,
  getUserCategories as getCategories,
  saveUserCategories as saveCategories,
  getUserLoans as getLoans,
  saveUserLoans as saveLoans,
  getUserGoals as getGoals,
  saveUserGoals as saveGoals,
  getUserSettings as getSettings,
  saveUserSettings as saveSettings,
  generateUserVoucherId as generateVoucherId,
  exportUserData as exportData,
  exportUserData as exportAllData,
  importUserData as importData,
  resetUserData as resetData,
  resetUserData as resetAllData
} from './userStorage';

import { formatCurrencyWithSettings } from './currencyUtils';

// Re-export for backward compatibility
export {
  getTransactions,
  saveTransactions,
  getUsers,
  saveUsers,
  getCategories,
  saveCategories,
  getLoans,
  saveLoans,
  getGoals,
  saveGoals,
  getSettings,
  saveSettings,
  generateVoucherId,
  exportData,
  exportAllData,
  importData,
  resetData,
  resetAllData
};

// Updated utility function for formatting currency with user settings
export const formatCurrency = (amount: number): string => {
  const settings = getSettings();
  return formatCurrencyWithSettings(amount, settings.currency);
};