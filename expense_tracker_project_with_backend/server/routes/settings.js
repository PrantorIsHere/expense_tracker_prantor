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
      const now = new Date().toISOString();
      const newRow = { id: uuidv4(), user_id: req.user.id, ...DEFAULT_SETTINGS, created_at: now, updated_at: now };
      db.get('settings').push(newRow).write();
      return res.json(newRow);
    }
    res.json({ ...DEFAULT_SETTINGS, ...row });
  } catch (e) {
    console.error('get settings error', e);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings — update settings for current user
router.put('/', authenticateToken, (req, res) => {
  try {
    const { currency, dateFormat, theme, notifications, autoBackup, softwareName } = req.body;
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
      softwareName:  softwareName  !== undefined ? softwareName  : row.softwareName,
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
// ─────────────────────────────────────────────────────────────────────────────

const BACKUP_VERSION = 2;

const ensureCollection = (key) => {
  if (!db.has(key).value()) db.set(key, []).write();
};

// GET /api/settings/export — full raw backup of every record, enriched dynamically
router.get('/export', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Collections
    const accounts = db.get('accounts').filter({ user_id: userId }).value() || [];
    const financialUsers = db.get('financial_users').filter({ user_id: userId }).value() || [];
    const categories = db.get('categories').filter((c) => c.user_id === null || c.user_id === userId).value() || [];
    const loans = db.get('loans').filter({ user_id: userId }).value() || [];
    const goals = db.get('goals').filter({ user_id: userId }).value() || [];
    const voucherCounters = db.get('voucher_counters').filter({ user_id: userId }).value() || [];

    // Lookup maps for dynamic enrichment on every transaction node
    const catMap = new Map();
    categories.forEach((c) => {
      if (c && c.id) catMap.set(c.id, c);
    });

    const userMap = new Map();
    financialUsers.forEach((u) => {
      if (u && u.id) userMap.set(u.id, u.name);
    });

    const accMap = new Map();
    accounts.forEach((a) => {
      if (a && a.id) accMap.set(a.id, a.name);
    });

    const rawTxs = db.get('transactions').filter({ user_id: userId }).value() || [];
    const enrichedTransactions = rawTxs.map((t) => {
      const catId = t.category_id || t.categoryId || null;
      const fUserId = t.financial_user_id || t.userId || null;
      const accId = t.account_id || t.accountId || t.from_account_id || t.fromAccountId || null;
      const toAccId = t.to_account_id || t.toAccountId || null;

      const catObj = catId ? catMap.get(catId) : null;
      let fromAccName = t.account_name || (accId ? accMap.get(accId) : null) || null;
      let toAccName = t.to_account_name || (toAccId ? accMap.get(toAccId) : null) || null;

      if (t.type === 'transfer' && (!fromAccName || !toAccName) && typeof t.title === 'string' && t.title.includes('→')) {
        const parts = t.title.replace(/^Transfer:\s*/i, '').split('→');
        if (!fromAccName && parts[0]) fromAccName = parts[0].trim();
        if (!toAccName && parts[1]) toAccName = parts[1].trim();
      }

      return {
        ...t,
        category_id:       catId,
        category_name:     catObj ? catObj.name : (t.category_name || t.category || null),
        category_color:    catObj ? catObj.color : (t.category_color || null),
        financial_user_id: fUserId,
        user_name:         fUserId ? (userMap.get(fUserId) || t.user_name || null) : (t.user_name || null),
        account_id:        accId,
        account_name:      fromAccName,
        to_account_id:     toAccId,
        to_account_name:   toAccName,
      };
    });

    const backup = {
      app: 'expense-tracker',
      backupVersion: BACKUP_VERSION,
      exportDate: new Date().toISOString(),
      accounts,
      transactions: enrichedTransactions,
      categories,
      financialUsers,
      loans,
      goals,
      voucherCounters,
      additionalInfo: {
        transactionHistory: db.get('transaction_history').filter({ user_id: userId }).value() || [],
        rentHistory:        db.get('rent_history').filter({ user_id: userId }).value() || [],
        gadgetWarranties:   db.get('gadget_warranties').filter({ user_id: userId }).value() || [],
      },
      settings: db.get('settings').find({ user_id: userId }).value() || DEFAULT_SETTINGS,
      counts: {
        accounts:        accounts.length,
        transactions:    enrichedTransactions.length,
        categories:      categories.length,
        financialUsers:  financialUsers.length,
        loans:           loans.length,
        goals:           goals.length,
        voucherCounters: voucherCounters.length,
      },
    };

    res.json(backup);
  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// POST /api/settings/import — fully dynamic restore: maps, discovers and links all categories, users, accounts & transactions
router.post('/import', authenticateToken, (req, res) => {
  try {
    const data = req.body;
    const userId = req.user.id;
    const now = new Date().toISOString();

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid backup file' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. DYNAMIC CATEGORIES: discover, register & link
    // ─────────────────────────────────────────────────────────────────────────
    ensureCollection('categories');
    const existingDbCategories = db.get('categories')
      .filter((c) => c.user_id === null || c.user_id === userId)
      .value() || [];

    // Map by lowercase name -> Category object
    const categoryByName = new Map();
    existingDbCategories.forEach((c) => {
      if (c && c.name) categoryByName.set(c.name.trim().toLowerCase(), c);
    });

    // Old ID -> active ID remap
    const categoryIdRemap = new Map();

    // Collect all candidate categories: from data.categories AND dynamically discovered from transactions
    const rawCategories = Array.isArray(data.categories) ? data.categories : [];
    const discoveredCategoryNames = new Set();

    if (Array.isArray(data.transactions)) {
      for (const t of data.transactions) {
        if (!t) continue;
        const name = t.category_name || t.categoryName || t.category;
        if (typeof name === 'string' && name.trim()) {
          discoveredCategoryNames.add(name.trim());
        }
      }
    }

    // Process explicit categories from file
    for (const cat of rawCategories) {
      if (!cat || typeof cat !== 'object') continue;
      const catName = String(cat.name || '').trim();
      if (!catName) continue;
      const lower = catName.toLowerCase();

      let targetCat = categoryByName.get(lower);
      if (!targetCat) {
        // Create user category dynamically
        const newCat = {
          id:         cat.id || uuidv4(),
          user_id:    userId,
          name:       catName,
          color:      cat.color || `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
          icon:       cat.icon || '📁',
          created_at: cat.created_at || cat.createdAt || now,
          updated_at: cat.updated_at || cat.updatedAt || now,
        };
        db.get('categories').push(newCat).value();
        categoryByName.set(lower, newCat);
        targetCat = newCat;
      }
      if (cat.id) {
        categoryIdRemap.set(cat.id, targetCat.id);
      }
    }

    // Process categories discovered from transaction nodes
    for (const catName of discoveredCategoryNames) {
      const lower = catName.toLowerCase();
      if (!categoryByName.has(lower)) {
        const newCat = {
          id:         uuidv4(),
          user_id:    userId,
          name:       catName,
          color:      `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
          icon:       '📁',
          created_at: now,
          updated_at: now,
        };
        db.get('categories').push(newCat).value();
        categoryByName.set(lower, newCat);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. DYNAMIC FINANCIAL USERS: discover, register & link
    // ─────────────────────────────────────────────────────────────────────────
    ensureCollection('financial_users');
    const existingDbUsers = db.get('financial_users')
      .filter((u) => u.user_id === userId)
      .value() || [];

    const userByName = new Map();
    existingDbUsers.forEach((u) => {
      if (u && u.name) userByName.set(u.name.trim().toLowerCase(), u);
    });

    const userIdRemap = new Map();
    const rawFinancialUsers = Array.isArray(data.financialUsers) ? data.financialUsers : [];
    const discoveredUserNames = new Set();

    if (Array.isArray(data.transactions)) {
      for (const t of data.transactions) {
        if (!t) continue;
        const name = t.user_name || t.userName || t.user;
        if (typeof name === 'string' && name.trim()) {
          discoveredUserNames.add(name.trim());
        }
      }
    }

    for (const u of rawFinancialUsers) {
      if (!u || typeof u !== 'object') continue;
      const uName = String(u.name || '').trim();
      if (!uName) continue;
      const lower = uName.toLowerCase();

      let targetUser = userByName.get(lower);
      if (!targetUser) {
        const newUser = {
          id:         u.id || uuidv4(),
          user_id:    userId,
          name:       uName,
          email:      u.email || '',
          phone:      u.phone || '',
          type:       u.type || 'personal',
          notes:      u.notes || '',
          created_at: u.created_at || u.createdAt || now,
          updated_at: u.updated_at || u.updatedAt || now,
        };
        db.get('financial_users').push(newUser).value();
        userByName.set(lower, newUser);
        targetUser = newUser;
      }
      if (u.id) {
        userIdRemap.set(u.id, targetUser.id);
      }
    }

    for (const uName of discoveredUserNames) {
      const lower = uName.toLowerCase();
      if (!userByName.has(lower)) {
        const newUser = {
          id:         uuidv4(),
          user_id:    userId,
          name:       uName,
          email:      '',
          phone:      '',
          type:       'personal',
          notes:      '',
          created_at: now,
          updated_at: now,
        };
        db.get('financial_users').push(newUser).value();
        userByName.set(lower, newUser);
      }
    }

    // Ensure default "Self" user exists
    if (!userByName.has('self')) {
      const defaultSelf = {
        id:         uuidv4(),
        user_id:    userId,
        name:       'Self',
        email:      '',
        phone:      '',
        type:       'personal',
        notes:      'Default personal profile',
        created_at: now,
        updated_at: now,
      };
      db.get('financial_users').push(defaultSelf).value();
      userByName.set('self', defaultSelf);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. DYNAMIC ACCOUNTS: discover, register & link
    // ─────────────────────────────────────────────────────────────────────────
    ensureCollection('accounts');
    const existingDbAccounts = db.get('accounts')
      .filter((a) => a.user_id === userId)
      .value() || [];

    const accountByName = new Map();
    existingDbAccounts.forEach((a) => {
      if (a && a.name) accountByName.set(a.name.trim().toLowerCase(), a);
    });

    const accountIdRemap = new Map();
    const rawAccounts = Array.isArray(data.accounts) ? data.accounts : [];
    const discoveredAccountNames = new Set();

    if (Array.isArray(data.transactions)) {
      for (const t of data.transactions) {
        if (!t) continue;
        const fromName = t.account_name || t.accountName || (typeof t.account === 'string' ? t.account : null);
        const toName = t.to_account_name || t.toAccountName;
        if (fromName) discoveredAccountNames.add(fromName.trim());
        if (toName) discoveredAccountNames.add(toName.trim());
        if (t.type === 'transfer' && typeof t.title === 'string' && t.title.includes('→')) {
          const parts = t.title.replace(/^Transfer:\s*/i, '').split('→');
          if (parts[0]) discoveredAccountNames.add(parts[0].trim());
          if (parts[1]) discoveredAccountNames.add(parts[1].trim());
        }
      }
    }

    for (const a of rawAccounts) {
      if (!a || typeof a !== 'object') continue;
      const aName = String(a.name || '').trim();
      if (!aName) continue;
      const lower = aName.toLowerCase();

      let targetAcc = accountByName.get(lower);
      if (!targetAcc) {
        const newAcc = {
          id:              a.id || uuidv4(),
          user_id:         userId,
          name:            aName,
          type:            a.type || 'bank',
          account_number:  a.account_number ?? a.accountNumber ?? null,
          initial_balance: parseFloat(a.initial_balance ?? a.initialBalance ?? 0) || 0,
          color:           a.color || '#4ECDC4',
          icon:            a.icon || '🏦',
          created_at:      a.created_at || a.createdAt || now,
          updated_at:      a.updated_at || a.updatedAt || now,
        };
        db.get('accounts').push(newAcc).value();
        accountByName.set(lower, newAcc);
        targetAcc = newAcc;
      } else {
        // Update initial balance from backup if present
        if (a.initial_balance !== undefined || a.initialBalance !== undefined) {
          const initBal = parseFloat(a.initial_balance ?? a.initialBalance ?? 0) || 0;
          db.get('accounts').find({ id: targetAcc.id }).assign({ initial_balance: initBal }).value();
          targetAcc.initial_balance = initBal;
        }
      }
      if (a.id) {
        accountIdRemap.set(a.id, targetAcc.id);
      }
    }

    for (const aName of discoveredAccountNames) {
      const lower = aName.toLowerCase();
      if (!accountByName.has(lower)) {
        const newAcc = {
          id:              uuidv4(),
          user_id:         userId,
          name:            aName,
          type:            lower.includes('bank') ? 'bank' : lower.includes('cash') ? 'cash' : 'mobile_wallet',
          account_number:  null,
          initial_balance: 0,
          color:           lower.includes('cash') ? '#10B981' : '#3B82F6',
          icon:            lower.includes('cash') ? '💵' : '🏦',
          created_at:      now,
          updated_at:      now,
        };
        db.get('accounts').push(newAcc).value();
        accountByName.set(lower, newAcc);
      }
    }

    if (!accountByName.has('cash')) {
      const defaultCash = {
        id:              uuidv4(),
        user_id:         userId,
        name:            'Cash',
        type:            'cash',
        account_number:  null,
        initial_balance: 0,
        color:           '#10B981',
        icon:            '💵',
        created_at:      now,
        updated_at:      now,
      };
      db.get('accounts').push(defaultCash).value();
      accountByName.set('cash', defaultCash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. DYNAMIC TRANSACTIONS: point each transaction node to resolved category, user & account
    // ─────────────────────────────────────────────────────────────────────────
    ensureCollection('transactions');
    db.get('transactions').remove({ user_id: userId }).value();

    const rawTxs = Array.isArray(data.transactions) ? data.transactions : [];
    const transactionsList = rawTxs.map((t) => {
      // 1) Category resolution
      let catId = t.category_id || t.categoryId || null;
      if (catId && categoryIdRemap.has(catId)) catId = categoryIdRemap.get(catId);

      let catName = t.category_name || t.categoryName || t.category || null;
      let catColor = t.category_color || t.categoryColor || null;

      if (catName && typeof catName === 'string') {
        const found = categoryByName.get(catName.trim().toLowerCase());
        if (found) {
          catId = found.id;
          catName = found.name;
          catColor = found.color;
        }
      } else if (catId) {
        // Find by ID in categoryByName
        for (const c of categoryByName.values()) {
          if (c.id === catId) {
            catName = c.name;
            catColor = c.color;
            break;
          }
        }
      }

      // 2) Financial User resolution
      let fUserId = t.financial_user_id || t.financialUserId || t.userId || null;
      if (fUserId && userIdRemap.has(fUserId)) fUserId = userIdRemap.get(fUserId);

      let uName = t.user_name || t.userName || t.user || null;
      if (uName && typeof uName === 'string') {
        const found = userByName.get(uName.trim().toLowerCase());
        if (found) {
          fUserId = found.id;
          uName = found.name;
        }
      } else if (fUserId) {
        for (const u of userByName.values()) {
          if (u.id === fUserId) {
            uName = u.name;
            break;
          }
        }
      }
      if (!fUserId) {
        const selfUser = userByName.get('self');
        if (selfUser) {
          fUserId = selfUser.id;
          uName = selfUser.name;
        }
      }

      // 3) Account resolution
      let fromAccId = t.account_id || t.accountId || t.from_account_id || t.fromAccountId || null;
      if (fromAccId && accountIdRemap.has(fromAccId)) fromAccId = accountIdRemap.get(fromAccId);

      let toAccId = t.to_account_id || t.toAccountId || null;
      if (toAccId && accountIdRemap.has(toAccId)) toAccId = accountIdRemap.get(toAccId);

      let fromName = t.account_name || t.accountName || (typeof t.account === 'string' ? t.account : null);
      let toName = t.to_account_name || t.toAccountName || null;

      if (t.type === 'transfer' && (!fromName || !toName) && typeof t.title === 'string' && t.title.includes('→')) {
        const parts = t.title.replace(/^Transfer:\s*/i, '').split('→');
        if (!fromName && parts[0]) fromName = parts[0].trim();
        if (!toName && parts[1]) toName = parts[1].trim();
      }

      if (fromName && typeof fromName === 'string') {
        const found = accountByName.get(fromName.trim().toLowerCase());
        if (found) {
          fromAccId = found.id;
          fromName = found.name;
        }
      }
      if (toName && typeof toName === 'string') {
        const found = accountByName.get(toName.trim().toLowerCase());
        if (found) {
          toAccId = found.id;
          toName = found.name;
        }
      }

      if (!fromAccId && t.type !== 'transfer') {
        const defaultCash = accountByName.get('cash') || Array.from(accountByName.values())[0];
        if (defaultCash) {
          fromAccId = defaultCash.id;
          fromName = defaultCash.name;
        }
      }

      return {
        id:                t.id || uuidv4(),
        user_id:           userId,
        voucher_id:        t.voucher_id || t.voucherId || null,
        title:             t.title || 'Transaction',
        description:       t.description || '',
        amount:            parseFloat(t.amount) || 0,
        type:              t.type || 'expense',
        category_id:       catId,
        category_name:     catName,
        category_color:    catColor,
        financial_user_id: fUserId,
        user_name:         uName,
        account_id:        fromAccId,
        account_name:      fromName,
        to_account_id:     toAccId,
        to_account_name:   toName,
        loan_id:           t.loan_id || t.loanId || null,
        date:              t.date || t.created_at || t.createdAt || now,
        created_at:        t.created_at || t.createdAt || now,
        updated_at:        t.updated_at || t.updatedAt || now,
      };
    });

    for (const item of transactionsList) {
      db.get('transactions').push(item).value();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. DYNAMIC LOANS
    // ─────────────────────────────────────────────────────────────────────────
    ensureCollection('loans');
    db.get('loans').remove({ user_id: userId }).value();

    const rawLoans = Array.isArray(data.loans) ? data.loans : [];
    const loansList = rawLoans.map((l) => {
      const amt = parseFloat(l.amount) || 0;
      let repaid = parseFloat(l.repaid_amount ?? l.repaidAmount ?? 0) || 0;
      const forgiven = parseFloat(l.forgiven_amount ?? l.forgivenAmount ?? 0) || 0;
      let status = l.status || 'pending';

      if (['paid', 'repaid'].includes(status) && repaid === 0) {
        repaid = amt;
      }

      let accId = l.account_id || l.accountId || null;
      if (accId && accountIdRemap.has(accId)) accId = accountIdRemap.get(accId);
      if (!accId && l.account_name) {
        const found = accountByName.get(String(l.account_name).trim().toLowerCase());
        if (found) accId = found.id;
      }

      let fUserId = l.financial_user_id || l.financialUserId || l.userId || null;
      if (fUserId && userIdRemap.has(fUserId)) fUserId = userIdRemap.get(fUserId);

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
        financial_user_id: fUserId,
        repaid_account_id: l.repaid_account_id || l.repaidAccountId || null,
        date:              l.date || l.created_at || l.createdAt || now,
        created_at:        l.created_at || l.createdAt || now,
        updated_at:        l.updated_at || l.updatedAt || now,
      };
    });

    for (const item of loansList) {
      db.get('loans').push(item).value();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. DYNAMIC GOALS
    // ─────────────────────────────────────────────────────────────────────────
    ensureCollection('goals');
    db.get('goals').remove({ user_id: userId }).value();

    const rawGoals = Array.isArray(data.goals) ? data.goals : [];
    const goalsList = rawGoals.map((g) => ({
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

    for (const item of goalsList) {
      db.get('goals').push(item).value();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. VOUCHER COUNTERS, ADDITIONAL INFO & SETTINGS
    // ─────────────────────────────────────────────────────────────────────────
    ensureCollection('voucher_counters');
    db.get('voucher_counters').remove({ user_id: userId }).value();
    if (Array.isArray(data.voucherCounters)) {
      for (const vc of data.voucherCounters) {
        if (vc && typeof vc === 'object') {
          db.get('voucher_counters').push({ ...vc, user_id: userId }).value();
        }
      }
    }

    const additionalInfo = data.additionalInfo && typeof data.additionalInfo === 'object' ? data.additionalInfo : {};
    ensureCollection('transaction_history');
    ensureCollection('rent_history');
    ensureCollection('gadget_warranties');

    db.get('transaction_history').remove({ user_id: userId }).value();
    if (Array.isArray(additionalInfo.transactionHistory)) {
      for (const item of additionalInfo.transactionHistory) {
        db.get('transaction_history').push({ ...item, user_id: userId, created_at: item.created_at || now }).value();
      }
    }

    db.get('rent_history').remove({ user_id: userId }).value();
    if (Array.isArray(additionalInfo.rentHistory)) {
      for (const item of additionalInfo.rentHistory) {
        db.get('rent_history').push({ ...item, user_id: userId, created_at: item.created_at || now }).value();
      }
    }

    db.get('gadget_warranties').remove({ user_id: userId }).value();
    if (Array.isArray(additionalInfo.gadgetWarranties)) {
      for (const item of additionalInfo.gadgetWarranties) {
        db.get('gadget_warranties').push({ ...item, user_id: userId, created_at: item.created_at || now }).value();
      }
    }

    if (data.settings && typeof data.settings === 'object') {
      const { id: _id, user_id: _uid, created_at: _ca, ...importedSettings } = data.settings;
      const row = db.get('settings').find({ user_id: userId }).value();
      if (row) {
        db.get('settings').find({ user_id: userId }).assign({ ...importedSettings, user_id: userId, updated_at: now }).value();
      } else {
        db.get('settings').push({ id: uuidv4(), user_id: userId, ...DEFAULT_SETTINGS, ...importedSettings, created_at: now, updated_at: now }).value();
      }
    }

    // Recompute loans from transactions
    for (const l of loansList) {
      try {
        recomputeLoan(userId, l.id);
      } catch {
        /* ignore */
      }
    }

    db.write();

    // Calculate dynamic live balances
    const userTxs = db.get('transactions').filter({ user_id: userId }).value();
    const liveAccounts = db.get('accounts').filter({ user_id: userId }).value().map((acc) => ({
      ...acc,
      current_balance: calculateAccountBalance(acc, userTxs),
    }));

    const finalCategories = db.get('categories').filter((c) => c.user_id === null || c.user_id === userId).value();
    const finalUsers = db.get('financial_users').filter({ user_id: userId }).value();

    res.json({
      success: true,
      message: 'Data imported successfully',
      counts: {
        accounts:        liveAccounts.length,
        transactions:    transactionsList.length,
        categories:      finalCategories.length,
        financialUsers:  finalUsers.length,
        loans:           loansList.length,
        goals:           goalsList.length,
      },
      accounts: liveAccounts,
    });
  } catch (error) {
    console.error('Data import error:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

module.exports = router;
