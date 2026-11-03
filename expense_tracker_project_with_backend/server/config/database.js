const low = require('lowdb');
const { AsyncLocalStorage } = require('node:async_hooks');
const Memory = require('lowdb/adapters/Memory');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const usePostgres = Boolean(connectionString);
const context = new AsyncLocalStorage();
let localDb;
let pool;

if (usePostgres) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  pool.on('error', () => console.error('Idle database connection failed'));
} else if (process.env.VERCEL) {
  throw new Error('POSTGRES_URL or DATABASE_URL is required on Vercel');
} else {
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
  
  localDb = db;
}

// Keep the existing route API, with an isolated in-memory view for each request.
// PostgreSQL owns the durable copy. A row lock prevents lost concurrent writes.
const database = new Proxy({}, {
  get(_target, key) {
    if (key === 'middleware') return databaseMiddleware;
    if (key === 'close') return () => pool ? pool.end() : Promise.resolve();
    const active = context.getStore() || localDb;
    if (!active) throw new Error('Database access requires request context');
    const value = active[key];
    return typeof value === 'function' ? value.bind(active) : value;
  },
});

async function databaseMiddleware(req, res, next) {
  if (!pool) return next();
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '15000'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '30000'");
    const result = await client.query(
      'SELECT data FROM expense_tracker_private.app_state WHERE id = $1 FOR UPDATE',
      ['expense-tracker-prantor'],
    );
    if (!result.rows.length) throw new Error('Expense tracker database is not initialized');
    const initial = JSON.stringify(result.rows[0].data);
    const active = low(new Memory());
    active.setState(result.rows[0].data);
    active.defaults(require('../db/data.example.json')).write();
    const originalEnd = res.end;
    let ending = false;
    let released = false;
    const release = async (commit) => {
      if (released) return;
      released = true;
      try {
        const updated = JSON.stringify(active.getState());
        if (commit && updated !== initial) {
          await client.query(
            'UPDATE expense_tracker_private.app_state SET data = $1::jsonb, updated_at = now() WHERE id = $2',
            [updated, 'expense-tracker-prantor'],
          );
        }
        await client.query(commit ? 'COMMIT' : 'ROLLBACK');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    };
    // Commit before returning success to the browser. Failed handlers roll back.
    res.end = function (...args) {
      if (ending) return res;
      ending = true;
      release(res.statusCode < 400).then(
        () => originalEnd.apply(res, args),
        () => {
          console.error('Database transaction failed');
          res.end = originalEnd;
          res.removeHeader('Content-Length');
          res.removeHeader('ETag');
          res.status(503).json({ error: 'Unable to save data. Please try again.' });
        },
      );
      return res;
    };
    res.once('close', () => {
      if (!ending) release(false).catch(() => console.error('Database rollback failed'));
    });
    context.run(active, next);
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    console.error('Database request unavailable:', error.code || error.message);
    res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
  }
}

module.exports = database;
