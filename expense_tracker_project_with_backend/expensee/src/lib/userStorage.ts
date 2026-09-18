/**
 * userStorage.ts — Async API-backed storage layer.
 *
 * All data now lives in server/db/data.json (per-user, scoped by JWT).
 * localStorage is no longer used for any application data.
 *
 * Every function is async and returns a Promise.
 * Components should use these functions inside useEffect / React Query hooks.
 */

import { Transaction, User, Category, Loan, Goal, Account } from '@/components/types';
import { apiClient } from './api';
import { getDhakaDateKey } from './dhakaTime';

// ── Settings ──────────────────────────────────────────────────────────────────

export interface AppSettings {
  currency: string;
  dateFormat: string;
  theme: string;
  notifications: boolean;
  autoBackup: boolean;
  softwareName?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  theme: 'light',
  notifications: true,
  autoBackup: false,
  softwareName: 'Expense Tracker',
};

// ─────────────────────────────────────────────────────────────────────────────
// Transactions
// ─────────────────────────────────────────────────────────────────────────────

export const getUserTransactions = async (): Promise<Transaction[]> => {
  try {
    return (await apiClient.getTransactions()) as Transaction[];
  } catch (e) {
    console.error('getUserTransactions error:', e);
    return [];
  }
};

export const saveUserTransactions = async (_transactions: Transaction[]): Promise<void> => {
  // Transactions are saved individually via createTransaction / updateTransaction / deleteTransaction.
  // This function exists only for backward-compat; callers should migrate to granular methods.
  console.warn('saveUserTransactions: use createTransaction/updateTransaction/deleteTransaction instead');
};

// ─────────────────────────────────────────────────────────────────────────────
// Financial Users (Contacts)
// ─────────────────────────────────────────────────────────────────────────────

export const getUserFinancialUsers = async (): Promise<User[]> => {
  try {
    return (await apiClient.getFinancialUsers()) as User[];
  } catch (e) {
    console.error('getUserFinancialUsers error:', e);
    return [];
  }
};

export const saveUserFinancialUsers = async (users: User[]): Promise<void> => {
  // Bulk-replace is not directly supported; individual CRUD via apiClient methods.
  // This shim exists for backward compat — components should migrate to CRUD calls.
  console.warn('saveUserFinancialUsers: use createFinancialUser/updateFinancialUser/deleteFinancialUser instead');
  void users;
};

// ─────────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────────

export const getUserCategories = async (): Promise<Category[]> => {
  try {
    return (await apiClient.getCategories()) as Category[];
  } catch (e) {
    console.error('getUserCategories error:', e);
    return [];
  }
};

export const saveUserCategories = async (_categories: Category[]): Promise<void> => {
  console.warn('saveUserCategories: category mutation not yet implemented via server');
};

// ─────────────────────────────────────────────────────────────────────────────
// Accounts
// ─────────────────────────────────────────────────────────────────────────────

export const getUserAccounts = async (): Promise<Account[]> => {
  try {
    const raw = (await apiClient.getAccounts()) as Record<string, unknown>[];
    return raw.map(a => {
      const bal = Number(a.current_balance ?? a.balance ?? a.initial_balance ?? 0);
      return {
        id:             String(a.id ?? ''),
        name:           String(a.name ?? ''),
        type:           (a.type as Account['type']) || 'bank',
        bankName:       a.bank_name ? String(a.bank_name) : undefined,
        accountNumber:  a.account_number ? String(a.account_number) : undefined,
        initialBalance: Number(a.initial_balance ?? 0),
        currentBalance: bal,
        balance:        bal,
        color:          a.color ? String(a.color) : undefined,
        icon:           a.icon ? String(a.icon) : undefined,
        createdAt:      String(a.created_at ?? ''),
        updatedAt:      a.updated_at ? String(a.updated_at) : undefined,
      };
    });
  } catch (e) {
    console.error('getUserAccounts error:', e);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Loans
// ─────────────────────────────────────────────────────────────────────────────

export const getUserLoans = async (): Promise<Loan[]> => {
  try {
    return (await apiClient.getLoans()) as Loan[];
  } catch (e) {
    console.error('getUserLoans error:', e);
    return [];
  }
};

export const saveUserLoans = async (_loans: Loan[]): Promise<void> => {
  console.warn('saveUserLoans: use createLoan/updateLoan/deleteLoan instead');
};

// ─────────────────────────────────────────────────────────────────────────────
// Goals
// ─────────────────────────────────────────────────────────────────────────────

export const getUserGoals = async (): Promise<Goal[]> => {
  try {
    return (await apiClient.getGoals()) as Goal[];
  } catch (e) {
    console.error('getUserGoals error:', e);
    return [];
  }
};

export const saveUserGoals = async (_goals: Goal[]): Promise<void> => {
  console.warn('saveUserGoals: use createGoal/updateGoal/deleteGoal instead');
};

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

export const getUserSettings = async (): Promise<AppSettings> => {
  try {
    const s = (await apiClient.getSettings()) as Record<string, unknown>;
    const parsed = {
      currency:      String(s.currency      ?? DEFAULT_SETTINGS.currency),
      dateFormat:    String(s.dateFormat    ?? DEFAULT_SETTINGS.dateFormat),
      theme:         String(s.theme         ?? DEFAULT_SETTINGS.theme),
      notifications: Boolean(s.notifications ?? DEFAULT_SETTINGS.notifications),
      autoBackup:    Boolean(s.autoBackup   ?? DEFAULT_SETTINGS.autoBackup),
      softwareName:  String(s.softwareName  ?? DEFAULT_SETTINGS.softwareName),
    };
    cacheSettings(parsed);
    return parsed;
  } catch (e) {
    console.error('getUserSettings error:', e);
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveUserSettings = async (settings: AppSettings): Promise<void> => {
  try {
    await apiClient.updateSettings(settings);
    cacheSettings(settings);
  } catch (e) {
    console.error('saveUserSettings error:', e);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Voucher ID generation (server-side counter)
// ─────────────────────────────────────────────────────────────────────────────

export const generateUserVoucherId = async (): Promise<string> => {
  try {
    return await apiClient.nextVoucherId();
  } catch (e) {
    console.error('generateUserVoucherId error, falling back to local:', e);
    // Fallback: local timestamp-based ID if server is unreachable
    const dateStr = getDhakaDateKey();
    return `${dateStr}-${Date.now().toString().slice(-4)}`;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Export / Import / Reset  (all still supported)
// ─────────────────────────────────────────────────────────────────────────────

export const exportUserData = async (): Promise<void> => {
  try {
    const [transactions, financialUsers, categories, loans, goals, settings] = await Promise.all([
      getUserTransactions(),
      getUserFinancialUsers(),
      getUserCategories(),
      getUserLoans(),
      getUserGoals(),
      getUserSettings(),
    ]);

    const additionalInfo = {
      transactionHistory: (await apiClient.getAdditionalInfoTransactions()) || [],
      rentHistory:        (await apiClient.getRentHistory()) || [],
      gadgetWarranties:   (await apiClient.getGadgetWarranties()) || [],
    };

    const data = {
      transactions,
      financialUsers,
      categories,
      loans,
      goals,
      settings,
      additionalInfo,
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-backup-${getDhakaDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('exportUserData error:', e);
  }
};

export const importUserData = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        
        await apiClient.importData(data);
        
        // Cache new settings immediately if they were imported
        if (data.settings) {
          cacheSettings(data.settings);
        }
        
        resolve();
      } catch (err) {
        console.error('importUserData error:', err);
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
};

export const resetUserData = async (): Promise<void> => {
  console.warn('resetUserData: full reset via API not yet implemented');
};

// ─────────────────────────────────────────────────────────────────────────────
// Generic synchronous shims for backward compatibility
// (Some parts of App.tsx / index.css still call synchronous getSettings)
// These read from a localStorage cache written after every server fetch.
// ─────────────────────────────────────────────────────────────────────────────

const SETTINGS_CACHE_KEY = 'expense_tracker_settings_cache';

/** Write settings to a local cache so synchronous callers can read them. */
export const cacheSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    // Dispatch event so the current window (e.g. App.tsx theme listener) reacts immediately
    window.dispatchEvent(new StorageEvent('storage', { key: SETTINGS_CACHE_KEY }));
  } catch { /* ignore */ }
};

/** Synchronous settings read — returns cached value or defaults. */
export const getUserSettingsSync = (): AppSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (raw) return JSON.parse(raw) as AppSettings;
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
};
