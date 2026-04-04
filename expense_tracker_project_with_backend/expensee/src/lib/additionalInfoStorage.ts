import { getCurrentSession } from './auth';

export type TransactionHistoryItem = {
  id: string;
  name: string;
  amount: number;
};

export type RentHistoryItem = {
  id: string;
  month: string;
  amount: number;
  date: string; // ISO date string
  deedNote: string;
};

// Get user-specific storage key
const getUserKey = (baseKey: string): string => {
  const session = getCurrentSession();
  const userId = session?.userId;
  if (!userId) {
    // Fallback to non-user-specific key for backward compatibility
    return baseKey;
  }
  return `${baseKey}_${userId}`;
};

const TX_KEY = 'additional_info_transaction_history';
const RENT_KEY = 'additional_info_rent_history';

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getTransactionHistory(): TransactionHistoryItem[] {
  return readLocal<TransactionHistoryItem[]>(getUserKey(TX_KEY), []);
}

export function saveTransactionHistory(items: TransactionHistoryItem[]) {
  writeLocal<TransactionHistoryItem[]>(getUserKey(TX_KEY), items);
}

export function getRentHistory(): RentHistoryItem[] {
  return readLocal<RentHistoryItem[]>(getUserKey(RENT_KEY), []);
}

export function saveRentHistory(items: RentHistoryItem[]) {
  writeLocal<RentHistoryItem[]>(getUserKey(RENT_KEY), items);
}

// For export/import - get raw data with explicit userId
export function getTransactionHistoryForUser(userId: string): TransactionHistoryItem[] {
  return readLocal<TransactionHistoryItem[]>(`${TX_KEY}_${userId}`, []);
}

export function saveTransactionHistoryForUser(userId: string, items: TransactionHistoryItem[]) {
  writeLocal<TransactionHistoryItem[]>(`${TX_KEY}_${userId}`, items);
}

export function getRentHistoryForUser(userId: string): RentHistoryItem[] {
  return readLocal<RentHistoryItem[]>(`${RENT_KEY}_${userId}`, []);
}

export function saveRentHistoryForUser(userId: string, items: RentHistoryItem[]) {
  writeLocal<RentHistoryItem[]>(`${RENT_KEY}_${userId}`, items);
}

// Reset additional info for a user
export function resetAdditionalInfoForUser(userId: string) {
  localStorage.removeItem(`${TX_KEY}_${userId}`);
  localStorage.removeItem(`${RENT_KEY}_${userId}`);
}