const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = path.join(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'data.json');
const exampleDbPath = path.join(dbDir, 'data.example.json');

// If personal data.json doesn't exist yet (e.g. fresh clone), seed it from data.example.json
if (!fs.existsSync(dbPath) && fs.existsSync(exampleDbPath)) {
  try {
    fs.copyFileSync(exampleDbPath, dbPath);
    console.log('Initialized new personal database from data.example.json');
  } catch (err) {
    console.warn('Could not copy data.example.json, falling back to defaults:', err.message);
  }
}

const adapter = new FileSync(dbPath);
const db = low(adapter);

// Set defaults (only applied if the key doesn't exist yet)
db.defaults({
  users: [],
  transactions: [],
  categories: [
    { id: 'cat-1',  name: 'Food & Dining',    color: '#FF6B6B', icon: '🍔', user_id: null },
    { id: 'cat-2',  name: 'Transport',         color: '#4ECDC4', icon: '🚗', user_id: null },
    { id: 'cat-3',  name: 'Shopping',          color: '#45B7D1', icon: '🛍️', user_id: null },
    { id: 'cat-4',  name: 'Entertainment',     color: '#96CEB4', icon: '🎬', user_id: null },
    { id: 'cat-5',  name: 'Health & Medical',  color: '#FFEAA7', icon: '💊', user_id: null },
    { id: 'cat-6',  name: 'Bills & Utilities', color: '#DDA0DD', icon: '💡', user_id: null },
    { id: 'cat-7',  name: 'Salary',            color: '#90EE90', icon: '💰', user_id: null },
    { id: 'cat-8',  name: 'Business',          color: '#FFB347', icon: '💼', user_id: null },
    { id: 'cat-9',  name: 'Education',         color: '#87CEEB', icon: '📚', user_id: null },
    { id: 'cat-10', name: 'Other',             color: '#D3D3D3', icon: '📦', user_id: null },
    { id: 'cat-11', name: 'Transfer',          color: '#6366F1', icon: 'ArrowLeftRight', user_id: null },
    { id: 'cat-12', name: 'Loan',              color: '#8B5CF6', icon: 'landmark', user_id: null },
    { id: 'cat-13', name: 'Loan Repayment',    color: '#10B981', icon: 'receipt', user_id: null },
    { id: 'cat-14', name: 'Loan Forgiven / Bad Debt', color: '#EF4444', icon: 'shield-alert', user_id: null }
  ],
  // --- User settings (one row per user) ---
  settings: [],
  // --- Loans ---
  loans: [],
  // --- Goals ---
  goals: [],
  // --- Financial Users (people/contacts for tagging transactions) ---
  financial_users: [],
  // --- Accounts (Cash, Bank Accounts like MTB, BRAC Bank, Mobile Wallets) ---
  accounts: [],
  // --- Additional Info ---
  // transaction_history: named items used as quick-pick references
  transaction_history: [],
  // rent_history: monthly rent payment records
  rent_history: [],
  // gadget_warranties: warranty tracking items
  gadget_warranties: [],
  // --- Voucher counters: { user_id, date_key, counter } ---
  voucher_counters: [],
}).write();

console.log(`JSON database ready at: ${dbPath}`);

module.exports = db;
