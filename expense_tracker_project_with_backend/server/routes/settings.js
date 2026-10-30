const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { calculateAccountBalance } = require('./accounts');
const { recomputeLoan } = require('../lib/loanSync');

const router = express.Router();

const DEFAULT_SETTINGS = {
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  theme: 'light',
  notifications: true,
  autoBackup: false,
  softwareName: 'Expense Tracker',
};

// GET /api/settings — get settings for current user
router.get('/', authenticateToken, (req, res) => {
  try {
    const row = db.get('settings').find({ user_id: req.user.id }).value();
    if (!row) {
      // Auto-create default settings on first access
      const now = new Date().toISOString();
      const newRow = { id: uuidv4(), user_id: req.user.id, ...DEFAULT_SETTINGS, created_at: now, updated_at: now };
      db.get('settings').push(newRow).write();
      return res.json(newRow);
    }
    // Merge defaults so legacy rows (missing new fields) still return complete settings
    res.json({ ...DEFAULT_SETTINGS, ...row });
  } catch (e) {
    console.error('get settings error', e);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings — update settings for current user
router.put('/', authenticateToken, (req, res) => {
  try {
    const { currency, dateFormat, theme, notifications, autoBackup } = req.body;
    let row = db.get('settings').find({ user_id: req.user.id }).value();
    const now = new Date().toISOString();

    if (!row) {
      row = { id: uuidv4(), user_id: req.user.id, ...DEFAULT_SETTINGS, created_at: now };
      db.get('settings').push(row).write();
    }

    const updated = {
      ...row,
      currency:      currency      !== undefined ? currency      : row.currency,
      dateFormat:    dateFormat    !== undefined ? dateFormat    : row.dateFormat,
      theme:         theme         !== undefined ? theme         : row.theme,
      notifications: notifications !== undefined ? notifications : row.notifications,
      autoBackup:    autoBackup    !== undefined ? autoBackup    : row.autoBackup,
      softwareName:  req.body.softwareName !== undefined ? req.body.softwareName : row.softwareName,
      updated_at:    now,
    };

    db.get('settings').find({ user_id: req.user.id }).assign(updated).write();
    res.json(updated);
  } catch (e) {
    console.error('update settings error', e);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// Full backup: export / import
//
// Every per-user collection in server/db/data.json is listed here so that a
// single JSON backup file contains EVERYTHING (accounts, transactions, loans,
// goals, categories, financial users, settings, additional info, voucher
// counters) and importing it restores the user's workspace exactly.
// ─────────────────────────────────────────────────────────────────────────────

const BACKUP_VERSION = 2;

// backup key -> lowdb collection key
const TOP_LEVEL_COLLECTIONS = {
  accounts:        'accounts',
  transactions:    'transactions',
  categories:      'categories',
  financialUsers:  'financial_users',
  loans:           'loans',
  goals:           'goals',
  voucherCounters: 'voucher_counters',
};

const ADDITIONAL_INFO_COLLECTIONS = {
  transactionHistory: 'transaction_history',
  rentHistory:        'rent_history',
  gadgetWarranties:   'gadget_warranties',
};

// Fields that are computed by GET endpoints and must never be stored
const COMPUTED_FIELDS = {
  accounts:     ['current_balance', 'balance', 'currentBalance'],
  transactions: ['category_name', 'category_color', 'account_name', 'account_type', 'to_account_name', 'to_account_type'],
};

// Fields that reference the id of another record (remapped on id conflicts)
const REFERENCE_FIELDS = [
  'account_id', 'accountId',
  'to_account_id', 'toAccountId',
  'repaid_account_id',
  'category_id', 'categoryId',
  'financial_user_id', 'financialUserId',
  'loan_id', 'loanId',
  'forgiven_loan_id',
  'transaction_id', 'transactionId',
  'goal_id', 'goalId',
];

const ensureCollection = (key) => {
  if (!db.has(key).value()) db.set(key, []).write();
};

// GET /api/settings/export — full raw backup of every record owned by the current user
router.get('/export', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const ownedBy = (key) => {
      ensureCollection(key);
      return db.get(key).filter({ user_id: userId }).value();
    };

    const backup = {
      app: 'expense-tracker',
      backupVersion: BACKUP_VERSION,
      exportDate: new Date().toISOString(),
    };

    for (const [backupKey, dbKey] of Object.entries(TOP_LEVEL_COLLECTIONS)) {
      backup[backupKey] = ownedBy(dbKey);
    }

    backup.additionalInfo = {};
    for (const [backupKey, dbKey] of Object.entries(ADDITIONAL_INFO_COLLECTIONS)) {
      backup.additionalInfo[backupKey] = ownedBy(dbKey);
    }

    const settingsRow = db.get('settings').find({ user_id: userId }).value();
    backup.settings = { ...DEFAULT_SETTINGS, ...(settingsRow || {}) };

    backup.counts = {
      accounts:           backup.accounts.length,
      transactions:       backup.transactions.length,
      categories:         backup.categories.length,
      financialUsers:     backup.financialUsers.length,
      loans:              backup.loans.length,
      goals:              backup.goals.length,
      voucherCounters:    backup.voucherCounters.length,
      transactionHistory: backup.additionalInfo.transactionHistory.length,
      rentHistory:        backup.additionalInfo.rentHistory.length,
      gadgetWarranties:   backup.additionalInfo.gadgetWarranties.length,
    };

    res.json(backup);
  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// POST /api/settings/import — replace all data for the current user with a backup file
router.post('/import', authenticateToken, (req, res) => {
  try {
    const data = req.body;
    const userId = req.user.id;
    const now = new Date().toISOString();

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid backup file' });
    }

    const knownKeys = [...Object.keys(TOP_LEVEL_COLLECTIONS), 'additionalInfo', 'settings'];
    if (!knownKeys.some((k) => data[k] !== undefined)) {
      return res.status(400).json({ error: 'This file does not look like an Expense Tracker backup' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A) Normalize ACCOUNTS
    // ─────────────────────────────────────────────────────────────────────────
    let accountsList = [];
    if (Array.isArray(data.accounts)) {
      accountsList = data.accounts
        .filter((a) => a && typeof a === 'object')
        .map((a) => ({
          id:              a.id || uuidv4(),
          user_id:         userId,
          name:            String(a.name || 'Account').trim(),
          type:            a.type || 'bank',
          account_number:  a.account_number ?? a.accountNumber ?? null,
          initial_balance: parseFloat(a.initial_balance ?? a.initialBalance ?? 0) || 0,
          color:           a.color || '#4ECDC4',
          icon:            a.icon || '🏦',
          created_at:      a.created_at || a.createdAt || now,
          updated_at:      a.updated_at || a.updatedAt || now,
        }));
    }

    // If backup had no accounts (e.g. older backup), auto-discover accounts from transactions
    if (accountsList.length === 0) {
      const discovered = new Set();
      if (Array.isArray(data.transactions)) {
        for (const t of data.transactions) {
          if (!t) continue;
          const fromName = t.account_name || t.accountName || (typeof t.account === 'string' ? t.account : null);
          const toName = t.to_account_name || t.toAccountName;
          if (fromName) discovered.add(fromName.trim());
          if (toName) discovered.add(toName.trim());
          if (t.type === 'transfer' && typeof t.title === 'string' && t.title.includes('→')) {
            const parts = t.title.replace(/^Transfer:\s*/i, '').split('→');
            if (parts[0]) discovered.add(parts[0].trim());
            if (parts[1]) discovered.add(parts[1].trim());
          }
        }
      }
      discovered.add('Cash');
      accountsList = Array.from(discovered).map((name) => ({
        id:              uuidv4(),
        user_id:         userId,
        name,
        type:            name.toLowerCase().includes('bank') ? 'bank' : name.toLowerCase().includes('cash') ? 'cash' : 'mobile_wallet',
        account_number:  null,
        initial_balance: 0,
        color:           name.toLowerCase().includes('cash') ? '#10B981' : '#3B82F6',
        icon:            name.toLowerCase().includes('cash') ? '💵' : '🏦',
        created_at:      now,
        updated_at:      now,
      }));
    }

    // Fast lookup of accounts by lowercase name
    const findAccountByName = (name) => {
      if (!name || typeof name !== 'string') return null;
      const lower = name.trim().toLowerCase();
      return accountsList.find((a) => a.name.toLowerCase() === lower) || null;
    };
    const findAccountById = (id) => {
      if (!id) return null;
      return accountsList.find((a) => a.id === id) || null;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // B) Normalize TRANSACTIONS & link to accounts
    // ─────────────────────────────────────────────────────────────────────────
    let transactionsList = [];
    if (Array.isArray(data.transactions)) {
      transactionsList = data.transactions
        .filter((t) => t && typeof t === 'object')
        .map((t) => {
          let fromAccId = t.account_id || t.accountId || t.from_account_id || t.fromAccountId || null;
          let toAccId = t.to_account_id || t.toAccountId || null;
          let fromName = t.account_name || t.accountName || (typeof t.account === 'string' ? t.account : null);
          let toName = t.to_account_name || t.toAccountName || null;

          if (t.type === 'transfer' && (!fromName || !toName) && typeof t.title === 'string' && t.title.includes('→')) {
            const parts = t.title.replace(/^Transfer:\s*/i, '').split('→');
            if (parts.length === 2) {
              if (!fromName) fromName = parts[0].trim();
              if (!toName) toName = parts[1].trim();
            }
          }

          // Link by name if ID was missing or shifted
          if (!findAccountById(fromAccId) && fromName) {
            const matched = findAccountByName(fromName);
            if (matched) fromAccId = matched.id;
          }
          if (!findAccountById(toAccId) && toName) {
            const matchedTo = findAccountByName(toName);
            if (matchedTo) toAccId = matchedTo.id;
          }

          // Fallback to primary account if still null for standard transactions
          if (!fromAccId && t.type !== 'transfer' && accountsList.length > 0) {
            const cashAcc = findAccountByName('Cash') || accountsList[0];
            fromAccId = cashAcc.id;
            if (!fromName) fromName = cashAcc.name;
          }

          return {
            id:                t.id || uuidv4(),
            user_id:           userId,
            voucher_id:        t.voucher_id || t.voucherId || null,
            title:             t.title || 'Transaction',
            description:       t.description || '',
            amount:            parseFloat(t.amount) || 0,
            type:              t.type || 'expense',
            category_id:       t.category_id || t.categoryId || null,
            financial_user_id: t.financial_user_id || t.financialUserId || t.userId || null,
            account_id:        fromAccId,
            account_name:      fromName || (findAccountById(fromAccId)?.name ?? null),
            to_account_id:     toAccId,
            to_account_name:   toName || (findAccountById(toAccId)?.name ?? null),
            loan_id:           t.loan_id || t.loanId || null,
            date:              t.date || t.created_at || t.createdAt || now,
            created_at:        t.created_at || t.createdAt || now,
            updated_at:        t.updated_at || t.updatedAt || now,
          };
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // C) Normalize LOANS (ensure person, amounts and statuses are solid)
    // ─────────────────────────────────────────────────────────────────────────
    let loansList = [];
    if (Array.isArray(data.loans)) {
      loansList = data.loans
        .filter((l) => l && typeof l === 'object')
        .map((l) => {
          const amt = parseFloat(l.amount) || 0;
          let repaid = parseFloat(l.repaid_amount ?? l.repaidAmount ?? 0) || 0;
          const forgiven = parseFloat(l.forgiven_amount ?? l.forgivenAmount ?? 0) || 0;
          let status = l.status || 'pending';

          // If marked paid/repaid but repaid was 0, set repaid to principal
          if (['paid', 'repaid'].includes(status) && repaid === 0) {
            repaid = amt;
          }

          let accId = l.account_id || l.accountId || null;
          if (!findAccountById(accId) && l.account_name) {
            const matched = findAccountByName(l.account_name);
            if (matched) accId = matched.id;
          }

          return {
            id:                l.id || uuidv4(),
            user_id:           userId,
            transaction_id:    l.transaction_id || l.transactionId || null,
            person:            l.person || l.contactPerson || l.contact || 'Contact',
            amount:            amt,
            type:              l.type || 'given',
            status:            status,
            repaid_amount:     repaid,
            forgiven_amount:   forgiven,
            due_date:          l.due_date || l.dueDate || null,
            account_id:        accId,
            repaid_account_id: l.repaid_account_id || l.repaidAccountId || null,
            date:              l.date || l.created_at || l.createdAt || now,
            created_at:        l.created_at || l.createdAt || now,
            updated_at:        l.updated_at || l.updatedAt || now,
          };
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // D) Normalize GOALS
    // ─────────────────────────────────────────────────────────────────────────
    let goalsList = [];
    if (Array.isArray(data.goals)) {
      goalsList = data.goals
        .filter((g) => g && typeof g === 'object')
        .map((g) => ({
          id:             g.id || uuidv4(),
          user_id:        userId,
          name:           g.name || g.title || 'Goal',
          target_amount:  parseFloat(g.target_amount ?? g.targetAmount ?? 0) || 0,
          current_amount: parseFloat(g.current_amount ?? g.currentAmount ?? 0) || 0,
          deadline:       g.deadline || null,
          color:          g.color || '#3B82F6',
          icon:           g.icon || 'Target',
          priority:       g.priority || 'medium',
          status:         g.status || 'active',
          created_at:     g.created_at || g.createdAt || now,
          updated_at:     g.updated_at || g.updatedAt || now,
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // E) Normalize CATEGORIES (skip global/built-in)
    // ─────────────────────────────────────────────────────────────────────────
    const globalCategoryIds = new Set(
      db.get('categories').filter((c) => c.user_id === null || c.user_id === undefined).map('id').value()
    );
    let categoriesList = [];
    if (Array.isArray(data.categories)) {
      categoriesList = data.categories
        .filter((c) => c && typeof c === 'object' && c.user_id !== null && !globalCategoryIds.has(c.id))
        .map((c) => ({
          id:         c.id || uuidv4(),
          user_id:    userId,
          name:       String(c.name || 'Category').trim(),
          color:      c.color || '#4ECDC4',
          icon:       c.icon || '📁',
          created_at: c.created_at || c.createdAt || now,
          updated_at: c.updated_at || c.updatedAt || now,
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // F) Normalize FINANCIAL USERS
    // ─────────────────────────────────────────────────────────────────────────
    let financialUsersList = [];
    if (Array.isArray(data.financialUsers)) {
      financialUsersList = data.financialUsers
        .filter((u) => u && typeof u === 'object')
        .map((u) => ({
          id:         u.id || uuidv4(),
          user_id:    userId,
          name:       String(u.name || 'User').trim(),
          email:      u.email || '',
          phone:      u.phone || '',
          type:       u.type || 'personal',
          notes:      u.notes || '',
          created_at: u.created_at || u.createdAt || now,
          updated_at: u.updated_at || u.updatedAt || now,
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // G) Normalize VOUCHER COUNTERS
    // ─────────────────────────────────────────────────────────────────────────
    let voucherCountersList = [];
    if (Array.isArray(data.voucherCounters)) {
      voucherCountersList = data.voucherCounters
        .filter((vc) => vc && typeof vc === 'object')
        .map((vc) => ({
          ...vc,
          user_id: userId,
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H) Write collections to lowdb
    // ─────────────────────────────────────────────────────────────────────────
    const setCollection = (dbKey, items) => {
      ensureCollection(dbKey);
      db.get(dbKey).remove({ user_id: userId }).value();
      for (const item of items) {
        db.get(dbKey).push(item).value();
      }
    };

    setCollection('accounts', accountsList);
    setCollection('transactions', transactionsList);
    setCollection('loans', loansList);
    setCollection('goals', goalsList);
    setCollection('categories', categoriesList);
    setCollection('financial_users', financialUsersList);
    setCollection('voucher_counters', voucherCountersList);

    // Additional info
    const additionalInfo = data.additionalInfo && typeof data.additionalInfo === 'object' ? data.additionalInfo : {};
    if (Array.isArray(additionalInfo.transactionHistory)) {
      setCollection('transaction_history', additionalInfo.transactionHistory.map((item) => ({ ...item, user_id: userId, created_at: item.created_at || now })));
    }
    if (Array.isArray(additionalInfo.rentHistory)) {
      setCollection('rent_history', additionalInfo.rentHistory.map((item) => ({ ...item, user_id: userId, created_at: item.created_at || now })));
    }
    if (Array.isArray(additionalInfo.gadgetWarranties)) {
      setCollection('gadget_warranties', additionalInfo.gadgetWarranties.map((item) => ({ ...item, user_id: userId, created_at: item.created_at || now })));
    }

    // Settings
    if (data.settings && typeof data.settings === 'object') {
      // eslint-disable-next-line no-unused-vars
      const { id, user_id, created_at, ...importedSettings } = data.settings;
      const row = db.get('settings').find({ user_id: userId }).value();
      if (row) {
        db.get('settings').find({ user_id: userId }).assign({ ...importedSettings, user_id: userId, updated_at: now }).value();
      } else {
        db.get('settings').push({ id: uuidv4(), user_id: userId, ...DEFAULT_SETTINGS, ...importedSettings, created_at: now, updated_at: now }).value();
      }
    }

    // Recompute loans based on restored transactions
    for (const l of loansList) {
      try {
        recomputeLoan(userId, l.id);
      } catch {
        /* ignore */
      }
    }

    db.write();

    // Calculate dynamic live balances for all accounts immediately
    const userTxs = db.get('transactions').filter({ user_id: userId }).value();
    const liveAccounts = db.get('accounts').filter({ user_id: userId }).value().map((acc) => ({
      ...acc,
      current_balance: calculateAccountBalance(acc, userTxs),
    }));

    res.json({
      success: true,
      message: 'Data imported successfully',
      counts: {
        accounts:           accountsList.length,
        transactions:       transactionsList.length,
        loans:              loansList.length,
        goals:              goalsList.length,
        categories:         categoriesList.length,
        financialUsers:     financialUsersList.length,
        voucherCounters:    voucherCountersList.length,
      },
      accounts: liveAccounts,
    });
  } catch (error) {
    console.error('Data import error:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

module.exports = router;
