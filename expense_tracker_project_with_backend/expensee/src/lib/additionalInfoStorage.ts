/**
 * additionalInfoStorage.ts — Server-backed additional info storage.
 *
 * All data is now stored in server/db/data.json.
 * localStorage is no longer used. All functions are async.
 */

import { apiClient } from './api';

// ── Types (unchanged — shared with components) ────────────────────────────────

export type TransactionHistoryItem = {
  id: string;
  name: string;
  amount: number;
};

export type RentHistoryItem = {
  id: string;
  month: string;
  amount: number;
  date: string;
  deedNote: string;
};

export type GadgetWarrantyItem = {
  id: string;
  productId: string;
  serialNumber: string;
  name: string;
  purchaseDate: string;
  warrantyMonths: number;
  note: string;
};

// ── Transaction History ───────────────────────────────────────────────────────

export async function getTransactionHistory(): Promise<TransactionHistoryItem[]> {
  try {
    return (await apiClient.getAdditionalInfoTransactions()) as TransactionHistoryItem[];
  } catch (e) {
    console.error('getTransactionHistory error:', e);
    return [];
  }
}

export async function saveTransactionHistory(items: TransactionHistoryItem[]): Promise<void> {
  try {
    await apiClient.saveAdditionalInfoTransactions(items);
  } catch (e) {
    console.error('saveTransactionHistory error:', e);
  }
}

// ── Rent History ──────────────────────────────────────────────────────────────

export async function getRentHistory(): Promise<RentHistoryItem[]> {
  try {
    return (await apiClient.getRentHistory()) as RentHistoryItem[];
  } catch (e) {
    console.error('getRentHistory error:', e);
    return [];
  }
}

export async function saveRentHistory(items: RentHistoryItem[]): Promise<void> {
  try {
    await apiClient.saveRentHistory(items);
  } catch (e) {
    console.error('saveRentHistory error:', e);
  }
}

// ── Gadget Warranties ─────────────────────────────────────────────────────────

export async function getGadgetWarranties(): Promise<GadgetWarrantyItem[]> {
  try {
    return (await apiClient.getGadgetWarranties()) as GadgetWarrantyItem[];
  } catch (e) {
    console.error('getGadgetWarranties error:', e);
    return [];
  }
}

export async function saveGadgetWarranties(items: GadgetWarrantyItem[]): Promise<void> {
  try {
    await apiClient.saveGadgetWarranties(items);
  } catch (e) {
    console.error('saveGadgetWarranties error:', e);
  }
}

// ── Legacy shims for export/import functions that pass userId ─────────────────
// These delegate to the current user's server data (userId param is ignored
// because the JWT token on the server already scopes the data).

export async function getTransactionHistoryForUser(_userId: string): Promise<TransactionHistoryItem[]> {
  return getTransactionHistory();
}

export async function saveTransactionHistoryForUser(_userId: string, items: TransactionHistoryItem[]): Promise<void> {
  return saveTransactionHistory(items);
}

export async function getRentHistoryForUser(_userId: string): Promise<RentHistoryItem[]> {
  return getRentHistory();
}

export async function saveRentHistoryForUser(_userId: string, items: RentHistoryItem[]): Promise<void> {
  return saveRentHistory(items);
}

export async function getGadgetWarrantiesForUser(_userId: string): Promise<GadgetWarrantyItem[]> {
  return getGadgetWarranties();
}

export async function saveGadgetWarrantiesForUser(_userId: string, items: GadgetWarrantyItem[]): Promise<void> {
  return saveGadgetWarranties(items);
}

export async function resetAdditionalInfoForUser(_userId: string): Promise<void> {
  await Promise.all([
    apiClient.saveAdditionalInfoTransactions([]),
    apiClient.saveRentHistory([]),
    apiClient.saveGadgetWarranties([]),
  ]);
}
