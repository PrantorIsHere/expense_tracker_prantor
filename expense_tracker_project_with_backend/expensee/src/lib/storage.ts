/**
 * storage.ts — Public storage facade.
 *
 * Re-exports all async API-backed functions from userStorage and additionalInfoStorage.
 * Also provides a synchronous formatCurrency helper that uses a local settings cache.
 */

export * from './userStorage';
export * from './additionalInfoStorage';

// ── Backward-compatible aliases ───────────────────────────────────────────────
import {
  getUserTransactions    as getTransactions,
  saveUserTransactions   as saveTransactions,
  getUserFinancialUsers  as getUsers,
  saveUserFinancialUsers as saveUsers,
  getUserCategories      as getCategories,
  saveUserCategories     as saveCategories,
  getUserLoans           as getLoans,
  saveUserLoans          as saveLoans,
  getUserGoals           as getGoals,
  saveUserGoals          as saveGoals,
  getUserSettings        as getSettings,
  saveUserSettings       as saveSettings,
  generateUserVoucherId  as generateVoucherId,
  exportUserData         as exportData,
  exportUserData         as exportAllData,
  importUserData         as importData,
  resetUserData          as resetData,
  resetUserData          as resetAllData,
  getUserSettingsSync,
} from './userStorage';

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
  resetAllData,
};

// ── Currency formatting ───────────────────────────────────────────────────────
import { formatCurrencyWithSettings } from './currencyUtils';

/**
 * Synchronously formats a currency amount using the cached settings.
 * The cache is populated after the first server fetch of settings.
 */
export const formatCurrency = (amount: number): string => {
  const settings = getUserSettingsSync();
  return formatCurrencyWithSettings(amount, settings.currency);
};