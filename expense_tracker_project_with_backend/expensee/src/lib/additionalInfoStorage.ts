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
  return readLocal<TransactionHistoryItem[]>(TX_KEY, []);
}

export function saveTransactionHistory(items: TransactionHistoryItem[]) {
  writeLocal<TransactionHistoryItem[]>(TX_KEY, items);
}

export function getRentHistory(): RentHistoryItem[] {
  return readLocal<RentHistoryItem[]>(RENT_KEY, []);
}

export function saveRentHistory(items: RentHistoryItem[]) {
  writeLocal<RentHistoryItem[]>(RENT_KEY, items);
}