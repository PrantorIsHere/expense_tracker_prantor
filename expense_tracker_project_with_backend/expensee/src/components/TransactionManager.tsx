import { Fragment, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getUsers, getCategories, getAccounts, generateVoucherId, formatCurrency } from '@/lib/storage';
import { apiClient } from '@/lib/api';
import { downloadVoucher } from '@/lib/voucherGenerator';
import { downloadStatementPDF } from '@/lib/monthlyStatementPDF';
import { createStatementPeriod, selectStatementTransactions } from '@/lib/statementPeriod';
import {
  createDhakaTimestamp,
  formatDateDhaka,
  getDhakaDateInputValue,
  getStoredDateInputValue
} from '@/lib/dhakaTime';
import { RANGE_PRESETS, type DayRange, formatDayRange, inRange } from '@/lib/dateRange';
import { summarize, txMeta } from '@/lib/finance';
import DateRangePicker from '@/components/DateRangePicker';
import { AccountAvatar, Avatar, ControlPanel, GroupHeaderRows, PageBody, Pager, Sheet, Tag, TX_LABEL, TX_TONE } from '@/components/erp';
import { Transaction, User, Category, Account } from '@/components/types';
import { ArrowRight, ChevronRight, Download, Edit, FileText, Filter, Layers, Plus, Search, Trash2, X } from 'lucide-react';

interface TransactionManagerProps {
  onDataChange: () => void;
  /** Start with the list filtered to this account (from a dashboard account card). */
  initialAccountId?: string;
  /** Open the new-transaction form as soon as the data has loaded. */
  openNewOnMount?: boolean;
}

export default function TransactionManager({ onDataChange, initialAccountId, openNewOnMount }: TransactionManagerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [previewVoucherId, setPreviewVoucherId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterAccount, setFilterAccount] = useState(initialAccountId ?? 'all');
  const [filterUser, setFilterUser] = useState('all');
  const [tableRange, setTableRange] = useState<DayRange | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [groupBy, setGroupBy] = useState<'none' | 'type' | 'category' | 'account' | 'user' | 'month'>('none');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const openedOnMount = useRef(false);

  // Statement export is independent of table search, filters and pagination.
  const [statementRange, setStatementRange] = useState<DayRange>(
    () => RANGE_PRESETS.find(p => p.id === 'thisMonth')!.range()
  );

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    type: 'expense' as Transaction['type'],
    categoryId: '',
    accountId: '',
    userId: '',
    date: getDhakaDateInputValue()
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txnsRaw, usrs, cats, accs] = await Promise.all([
        apiClient.getTransactions(),
        getUsers(),
        getCategories(),
        getAccounts(),
      ]);
      // Map server snake_case → frontend camelCase
      const txns = (txnsRaw as Record<string, unknown>[]).map(mapServerTransaction);
      setTransactions(txns as Transaction[]);
      setUsers(usrs as User[]);
      setCategories(cats as Category[]);
      setAccounts(accs as Account[]);
    } catch (e) {
      console.error('loadData error', e);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    if (!loaded || !openNewOnMount || openedOnMount.current) return;
    openedOnMount.current = true;
    setEditingTransaction(null);
    setPreviewVoucherId('');
    setFormData({
      title: '', description: '', amount: '', type: 'expense', categoryId: '',
      accountId: initialAccountId || accounts[0]?.id || '', userId: '', date: getDhakaDateInputValue(),
    });
    setIsDialogOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /** Map server snake_case transaction to frontend camelCase Transaction */
  const mapServerTransaction = (t: Record<string, unknown>): Transaction => ({
    id:          String(t.id ?? ''),
    voucherId:   String(t.voucher_id ?? t.voucherId ?? ''),
    title:       String(t.title ?? ''),
    description: t.description ? String(t.description) : undefined,
    amount:      Number(t.amount ?? 0),
    type:        t.type as Transaction['type'],
    categoryId:  String(t.category_id ?? t.categoryId ?? ''),
    categoryName:  t.category_name ? String(t.category_name) : (t.categoryName ? String(t.categoryName) : undefined),
    categoryColor: t.category_color ? String(t.category_color) : (t.categoryColor ? String(t.categoryColor) : undefined),
    accountId:   String(t.account_id ?? t.accountId ?? ''),
    accountName: t.account_name ? String(t.account_name) : undefined,
    accountType:   t.account_type ? String(t.account_type) : undefined,
    toAccountId:   t.to_account_id || t.toAccountId ? String(t.to_account_id ?? t.toAccountId) : undefined,
    toAccountName: t.to_account_name ? String(t.to_account_name) : undefined,
    loanId:        t.loan_id ? String(t.loan_id) : (t.loanId ? String(t.loanId) : undefined),
    userId:        String(t.financial_user_id ?? t.userId ?? ''),
    userName:      t.user_name ? String(t.user_name) : (t.userName ? String(t.userName) : undefined),
    date:        String(t.date ?? ''),
    createdAt:   String(t.created_at ?? t.createdAt ?? ''),
    updatedAt:   String(t.updated_at ?? t.updatedAt ?? ''),
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      amount: '',
      type: 'expense',
      categoryId: '',
      accountId: accounts[0]?.id || '',
      userId: '',
      date: getDhakaDateInputValue()
    });
    setEditingTransaction(null);
    setPreviewVoucherId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.amount || !formData.categoryId || !formData.userId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const txDate = createDhakaTimestamp(formData.date);
      const payload = {
        title:             formData.title,
        description:       formData.description || undefined,
        amount:            parseFloat(formData.amount),
        type:              formData.type,
        category_id:       formData.categoryId || null,
        account_id:        formData.accountId || null,
        financial_user_id: formData.userId || null,
        date:              txDate,
      };

      if (editingTransaction) {
        await apiClient.updateTransaction(editingTransaction.id, payload);
      } else {
        // Generate exactly once on save — no wasted counter slots
        const vId = await generateVoucherId();
        setPreviewVoucherId(vId);  // show it briefly before dialog closes
        await apiClient.createTransaction({ ...payload, voucher_id: vId });
      }

      await loadData();
      onDataChange();
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      alert(`Failed to save transaction: ${(err as Error).message}`);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setPreviewVoucherId(transaction.voucherId);
    setFormData({
      title: transaction.title,
      description: transaction.description || '',
      amount: transaction.amount.toString(),
      type: transaction.type,
      categoryId: transaction.categoryId,
      accountId: transaction.accountId || '',
      userId: transaction.userId,
      date: getStoredDateInputValue(transaction.date)
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        await apiClient.deleteTransaction(id);
        await loadData();
        onDataChange();
      } catch (err) {
        alert(`Failed to delete transaction: ${(err as Error).message}`);
      }
    }
  };

  const handleDownloadVoucher = (transaction: Transaction) => {
    const user = users.find(u => u.id === transaction.userId)
      || users.find(u => transaction.userName && u.name.toLowerCase() === transaction.userName.toLowerCase())
      || (transaction.userName ? { id: transaction.userId || 'user', name: transaction.userName, createdAt: '' } : undefined);
    const category: Category = categories.find(c => c.id === transaction.categoryId)
      || categories.find(c => transaction.categoryName && c.name.toLowerCase() === transaction.categoryName.toLowerCase())
      || {
        id: transaction.categoryId || 'uncategorized',
        name: transaction.categoryName || 'Uncategorized',
        color: transaction.categoryColor || '#6B7280',
        createdAt: new Date().toISOString(),
      };
    
    if (user) {
      downloadVoucher(transaction, user, category);
    }
  };

  const statementPeriod = createStatementPeriod(statementRange.start, statementRange.end);
  const statementTransactions = selectStatementTransactions(transactions, statementPeriod);

  const handleDownloadStatement = () => {
    try {
      downloadStatementPDF(statementTransactions, users, categories, statementPeriod);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to generate statement PDF. Please try again.');
    }
  };

  const getFilteredTransactions = () => {
    return transactions.filter(transaction => {
      const matchesSearch = 
        transaction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.voucherId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || transaction.type === filterType;
      const matchesCategory = filterCategory === 'all' || transaction.categoryId === filterCategory;
      const matchesAccount = filterAccount === 'all' || transaction.accountId === filterAccount;
      const matchesUser = filterUser === 'all' || transaction.userId === filterUser;
      
      const matchesDate = inRange(getStoredDateInputValue(transaction.date), tableRange);

      return matchesSearch && matchesType && matchesCategory && matchesAccount && matchesUser && matchesDate;
    });
  };

  // Pagination logic
  const filteredTransactions = getFilteredTransactions();
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterCategory, filterAccount, filterUser, tableRange]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // ── List helpers ──────────────────────────────────────────────────────────
  const findUser = (t: Transaction) => users.find(u => u.id === t.userId)
    || users.find(u => t.userName && u.name.toLowerCase() === t.userName.toLowerCase());
  const findCategory = (t: Transaction) => categories.find(c => c.id === t.categoryId)
    || categories.find(c => t.categoryName && c.name.toLowerCase() === t.categoryName.toLowerCase());
  const findAccount = (id?: string, name?: string) => accounts.find(a => a.id === id)
    || accounts.find(a => name && a.name.toLowerCase() === name.toLowerCase());

  const totals = summarize(filteredTransactions);

  const groupKeyOf = (t: Transaction): { key: string; label: string } => {
    switch (groupBy) {
      case 'type': return { key: t.type, label: TX_LABEL[t.type] ?? t.type };
      case 'category': { const c = findCategory(t); return { key: c?.id ?? (t.categoryName || 'none'), label: c?.name ?? (t.categoryName || 'Uncategorized') }; }
      case 'account': { const a = findAccount(t.accountId, t.accountName); return { key: a?.id ?? (t.accountName || 'none'), label: a?.name ?? (t.accountName || 'No account') }; }
      case 'user': { const u = findUser(t); return { key: u?.id ?? (t.userName || 'none'), label: u?.name ?? (t.userName || 'Unassigned') }; }
      case 'month': { const key = getStoredDateInputValue(t.date).slice(0, 7); return { key, label: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${key}-01T00:00:00Z`)) }; }
      default: return { key: 'all', label: 'All' };
    }
  };

  const groups = groupBy === 'none' ? [] : (() => {
    const map = new Map<string, { key: string; label: string; rows: Transaction[] }>();
    for (const t of filteredTransactions) {
      const g = groupKeyOf(t);
      if (!map.has(g.key)) map.set(g.key, { ...g, rows: [] });
      map.get(g.key)!.rows.push(t);
    }
    const list = [...map.values()];
    return groupBy === 'month' ? list.sort((a, b) => b.key.localeCompare(a.key)) : list.sort((a, b) => b.rows.length - a.rows.length);
  })();

  const toggleGroup = (key: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const facets: { key: string; label: string; clear: () => void }[] = [];
  if (filterType !== 'all') facets.push({ key: 'type', label: `Type: ${TX_LABEL[filterType] ?? filterType}`, clear: () => setFilterType('all') });
  if (filterCategory !== 'all') facets.push({ key: 'cat', label: `Category: ${categories.find(c => c.id === filterCategory)?.name ?? '—'}`, clear: () => setFilterCategory('all') });
  if (filterAccount !== 'all') facets.push({ key: 'acc', label: `Account: ${accounts.find(a => a.id === filterAccount)?.name ?? '—'}`, clear: () => setFilterAccount('all') });
  if (filterUser !== 'all') facets.push({ key: 'user', label: `User: ${users.find(u => u.id === filterUser)?.name ?? '—'}`, clear: () => setFilterUser('all') });
  if (tableRange) facets.push({ key: 'date', label: `Date: ${formatDayRange(tableRange)}`, clear: () => setTableRange(null) });

  const renderRow = (transaction: Transaction) => {
    const user = findUser(transaction);
    const category = findCategory(transaction);
    const account = findAccount(transaction.accountId, transaction.accountName);
    const meta = txMeta(transaction.type);
    const who = user?.name || transaction.userName || 'Unknown';
    return (
      <TableRow key={transaction.id} className="group">
        <TableCell className="whitespace-nowrap pl-4 tabular-nums text-muted-foreground">{formatDateDhaka(transaction.date)}</TableCell>
        <TableCell className="hidden whitespace-nowrap font-mono text-xs text-muted-foreground sm:table-cell">{transaction.voucherId}</TableCell>
        <TableCell>
          <p className="font-medium">{transaction.title}</p>
          {transaction.description && <p className="max-w-xs truncate text-xs text-muted-foreground">{transaction.description}</p>}
          <span className="mt-1 inline-block sm:hidden"><Tag tone={TX_TONE[transaction.type]}>{TX_LABEL[transaction.type] ?? transaction.type}</Tag></span>
        </TableCell>
        <TableCell className="hidden sm:table-cell"><Tag tone={TX_TONE[transaction.type]}>{TX_LABEL[transaction.type] ?? transaction.type}</Tag></TableCell>
        <TableCell className="hidden md:table-cell">
          {category || transaction.categoryName ? (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category?.color || transaction.categoryColor || '#9ca3af' }} aria-hidden />
              {category?.name || transaction.categoryName}
            </span>
          ) : <span className="text-xs text-muted-foreground">Uncategorized</span>}
        </TableCell>
        <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
          {transaction.type === 'transfer' ? (
            <span className="flex items-center gap-1">
              {account?.name || transaction.accountName || 'Account'}
              <ArrowRight className="h-3 w-3" aria-label="to" />
              {findAccount(transaction.toAccountId, transaction.toAccountName)?.name || transaction.toAccountName || 'Account'}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <AccountAvatar name={account?.name || transaction.accountName || 'Cash'} bankName={account?.bankName} color={account?.color} size="xs" />
              {account?.name || transaction.accountName || 'Cash'}
            </span>
          )}
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <span className="flex items-center gap-2 whitespace-nowrap"><Avatar name={who} size="sm" />{who}</span>
        </TableCell>
        <TableCell className={`whitespace-nowrap text-right font-semibold tabular-nums ${meta.text}`}>
          {meta.prefix}{formatCurrency(transaction.amount)}
        </TableCell>
        <TableCell className="pr-3">
          <div className="flex justify-end gap-0.5 opacity-70 group-hover:opacity-100">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownloadVoucher(transaction)} aria-label={`Download voucher ${transaction.voucherId}`}>
              <Download className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(transaction)} aria-label={`Edit ${transaction.title}`}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => handleDelete(transaction.id)} aria-label={`Delete ${transaction.title}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const emptyMessage = categories.length === 0
    ? 'Add a category in Settings, then create a transaction.'
    : users.length === 0
      ? 'Add a user in the Users tab, then create a transaction.'
      : transactions.length > 0
        ? 'Nothing matches these filters. Remove a filter to see more.'
        : 'Create a transaction to see it here.';

  return (
    <>
      <ControlPanel
        title="Transactions"
        actions={
          <>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm}>
                  <Plus className="h-4 w-4" aria-hidden />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingTransaction ? 'Edit transaction' : 'New transaction'}</DialogTitle>
                </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Voucher ID — shown as preview (edit) or placeholder (new) */}
                        <div>
                          <Label htmlFor="voucherId">Voucher ID</Label>
                          <Input
                            id="voucherId"
                            value={editingTransaction ? editingTransaction.voucherId : previewVoucherId}
                            readOnly
                            placeholder="Assigned on save"
                            className="font-mono text-sm bg-muted cursor-default select-all"
                          />
                        </div>
                        <div>
                          <Label htmlFor="title">Title *</Label>
                          <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Transaction title"
                            required
                          />
                        </div>

                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Optional description"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="amount">Amount *</Label>
                            <Input
                              id="amount"
                              type="number"
                              step="0.01"
                              value={formData.amount}
                              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                              placeholder="0.00"
                              required
                            />
                          </div>

                          <div>
                            <Label htmlFor="date">Date *</Label>
                            <Input
                              id="date"
                              type="date"
                              value={formData.date}
                              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="type">Type *</Label>
                          <Select 
                            value={formData.type} 
                            onValueChange={(value: 'income' | 'expense' | 'loan_given' | 'loan_taken') => setFormData({ ...formData, type: value, categoryId: '' })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="income">Income</SelectItem>
                              <SelectItem value="expense">Expense</SelectItem>
                              <SelectItem value="loan_given">Loan Given</SelectItem>
                              <SelectItem value="loan_taken">Loan Taken</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="category">Category *</Label>
                          <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.length > 0 ? (
                                categories.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-3 h-3 rounded-full" 
                                        style={{ backgroundColor: category.color }}
                                      />
                                      {category.name}
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">
                                  No categories available. Please add categories first.
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          {categories.length === 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Go to Settings → Categories to add categories first.
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="user">User *</Label>
                          <Select value={formData.userId} onValueChange={(value) => setFormData({ ...formData, userId: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                            <SelectContent>
                              {users.length > 0 ? (
                                users.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">
                                  No users available. Please add users first.
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          {users.length === 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Go to Users tab to add financial users first.
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="account">Payment / Bank Account</Label>
                          <Select
                            value={formData.accountId}
                            onValueChange={(value) => setFormData({ ...formData, accountId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select account (Cash, Bank, Wallet)" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  <div className="flex items-center justify-between gap-3 w-full">
                                    <div className="flex items-center gap-2">
                                      <AccountAvatar name={acc.name} bankName={acc.bankName} color={acc.color} size="xs" />
                                      <span>{acc.name}</span>
                                    </div>
                                    <span className={`text-xs ${(acc.currentBalance ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      ({formatCurrency(acc.currentBalance ?? 0)})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                              {accounts.length === 0 && (
                                <div className="p-2 text-sm text-muted-foreground">
                                  Defaulting to Cash
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Saving updates this account's balance.
                          </p>
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={categories.length === 0 || users.length === 0}>
                            {editingTransaction ? 'Update' : 'Create'}
                          </Button>
                        </div>
                      </form>
              </DialogContent>
            </Dialog>

            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="secondary">
                  <FileText className="h-4 w-4" aria-hidden />
                  Statement
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="statementPeriod">Statement period</Label>
                  <DateRangePicker
                    id="statementPeriod"
                    value={statementRange}
                    onChange={range => range && setStatementRange(range)}
                    className="w-full"
                  />
                </div>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {statementTransactions.length === 0
                    ? 'No transactions in this period.'
                    : `${statementTransactions.length} transaction${statementTransactions.length === 1 ? '' : 's'}`}
                </p>
                <Button className="w-full" onClick={handleDownloadStatement} disabled={statementTransactions.length === 0}>
                  <Download className="h-4 w-4" aria-hidden />
                  Download PDF
                </Button>
              </PopoverContent>
            </Popover>
          </>
        }
      >
        {/* Search with filter facets */}
        <div className="flex min-h-9 w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-input bg-card px-2 py-1 focus-within:ring-2 focus-within:ring-ring sm:w-[26rem]">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {facets.map(f => (
            <span key={f.key} className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
              {f.label}
              <button type="button" onClick={f.clear} aria-label={`Remove ${f.label}`} className="rounded hover:bg-black/10 dark:hover:bg-white/10">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={facets.length ? '' : 'Search title or voucher ID'}
            aria-label="Search transactions"
            className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="secondary">
              <Filter className="h-4 w-4" aria-hidden />
              Filters{facets.length > 0 && <span className="tabular-nums">({facets.length})</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="filterType">Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger id="filterType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(TX_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filterCategory">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger id="filterCategory"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filterAccount">Account</Label>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger id="filterAccount"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filterUser">User</Label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger id="filterUser"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filterDate">Date</Label>
              <DateRangePicker id="filterDate" value={tableRange} onChange={setTableRange} clearLabel="All dates" className="w-full" align="end" />
            </div>
            {facets.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => facets.forEach(f => f.clear())}>Clear all filters</Button>
            )}
          </PopoverContent>
        </Popover>

        <Select value={groupBy} onValueChange={v => { setGroupBy(v as typeof groupBy); setCollapsed(new Set()); }}>
          <SelectTrigger className="h-8 w-48 text-[13px]" aria-label="Group by">
            <Layers className="mr-1 h-4 w-4 text-muted-foreground" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No grouping</SelectItem>
            <SelectItem value="type">Group by type</SelectItem>
            <SelectItem value="category">Group by category</SelectItem>
            <SelectItem value="account">Group by account</SelectItem>
            <SelectItem value="user">Group by user</SelectItem>
            <SelectItem value="month">Group by month</SelectItem>
          </SelectContent>
        </Select>

        {groupBy === 'none' && (
          <Pager
            from={filteredTransactions.length ? startIndex + 1 : 0}
            to={Math.min(endIndex, filteredTransactions.length)}
            total={filteredTransactions.length}
            onPrev={handlePreviousPage}
            onNext={handleNextPage}
          />
        )}
      </ControlPanel>

      <PageBody>
        <Sheet bodyClassName="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-medium">No transactions</p>
              <p className="mt-1 text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Voucher</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Account</TableHead>
                  <TableHead className="hidden lg:table-cell">User</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="pr-3 text-right"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupBy === 'none'
                  ? currentTransactions.map(renderRow)
                  : groups.map(g => {
                    const open = !collapsed.has(g.key);
                    const s = summarize(g.rows);
                    return (
                      <Fragment key={g.key}>
                        <GroupHeaderRows
                          spans={{ xs: [2, 1], sm: [4, 1], md: [5, 1], lg: [7, 1] }}
                          rowClassName="bg-muted/40 hover:bg-muted/60"
                          labelClassName="pl-2"
                          subtotalClassName={`font-semibold tabular-nums ${s.netCashFlow < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
                          subtotal={`${s.netCashFlow < 0 ? '-' : ''}${formatCurrency(Math.abs(s.netCashFlow))}`}
                          label={
                            <button type="button" onClick={() => toggleGroup(g.key)} aria-expanded={open}
                              className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold">
                              <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
                              {g.label}
                              <span className="font-normal text-muted-foreground">({g.rows.length})</span>
                            </button>
                          }
                        />
                        {open && g.rows.map(renderRow)}
                      </Fragment>
                    );
                  })}
              </TableBody>
            </Table>
          )}
          {filteredTransactions.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
              <span>{filteredTransactions.length} transactions</span>
              <span>In <span className="font-medium tabular-nums text-foreground">{formatCurrency(totals.cashIn)}</span></span>
              <span>Out <span className="font-medium tabular-nums text-foreground">{formatCurrency(totals.cashOut)}</span></span>
              <span className="ml-auto">
                Net{' '}
                <span className={`font-semibold tabular-nums ${totals.netCashFlow < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                  {totals.netCashFlow < 0 ? '-' : ''}{formatCurrency(Math.abs(totals.netCashFlow))}
                </span>
              </span>
            </div>
          )}
        </Sheet>
      </PageBody>
    </>
  );
}
