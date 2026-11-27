import { useState, useEffect } from 'react';
import { AccountAvatar, ControlPanel } from '@/components/erp';
import BankPicker, { type BankChoice } from '@/components/BankPicker';
import { findBankById, matchBank } from '@/lib/bankDirectory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  getSettings, 
  saveSettings, 
  getCategories, 
  getAccounts,
  getTransactions,
  getUsers,
  getLoans,
  getGoals,
  exportAllData,
  importData,
  resetAllData,
  formatCurrency
} from '@/lib/storage';
import { apiClient } from '@/lib/api';
import { getTransactionHistory, getRentHistory } from '@/lib/additionalInfoStorage';
import { SUPPORTED_CURRENCIES } from '@/lib/currencyUtils';
import UsersTab from './UsersTab';
import { Category, Account } from '@/components/types';
import { 
  Settings, 
  Users, 
  Tags, 
  Download, 
  Upload, 
  Trash2, 
  Plus,
  Edit2,
  Save,
  Landmark,
  Wallet,
  Smartphone,
  CreditCard,
  PiggyBank,
  Check,
  ArrowLeftRight,
  ArrowRight
} from 'lucide-react';
import { getDhakaDateInputValue } from '@/lib/dhakaTime';

interface SettingsPageProps {
  onDataChange: () => void;
}

interface AppSettings {
  currency: string;
  dateFormat: string;
  theme: string;
  notifications: boolean;
  autoBackup: boolean;
  softwareName?: string;
}

export default function SettingsPage({ onDataChange }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings>({
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    theme: 'light',
    notifications: true,
    autoBackup: false,
    softwareName: 'Expense Tracker'
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [categoryUsage, setCategoryUsage] = useState<Record<string, number>>({});

  // Accounts state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newAccountData, setNewAccountData] = useState({
    name: '',
    type: 'bank' as Account['type'],
    accountNumber: '',
    initialBalance: '',
    color: '#4ECDC4',
    bankId: '',
  });
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editAccountData, setEditAccountData] = useState({
    name: '',
    type: 'bank' as Account['type'],
    accountNumber: '',
    initialBalance: '',
    color: '#4ECDC4',
    bankId: '',
  });

  /**
   * Applies a bank picker choice to an account form: fills the account name when it is
   * empty or still the previous bank's name, and sets the type to match.
   */
  const applyBankChoice = <T extends { name: string; type: Account['type']; bankId: string }>(form: T, choice: BankChoice): T => {
    const previous = findBankById(form.bankId);
    const nameIsAuto = !form.name.trim() || form.name === previous?.short || (form.bankId === 'cash' && form.name === 'Cash');
    if (choice.kind === 'cash') return { ...form, bankId: 'cash', type: 'cash', name: nameIsAuto ? 'Cash' : form.name };
    if (choice.kind === 'other') return { ...form, bankId: '', name: choice.name || form.name };
    return { ...form, bankId: choice.bank.id, type: choice.bank.type, name: nameIsAuto ? choice.bank.short : form.name };
  };
  const bankNameFor = (bankId: string) => findBankById(bankId)?.name ?? null;

  // Transfer state
  const [transferData, setTransferData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    date: getDhakaDateInputValue(),
    notes: '',
  });
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferMessage, setTransferMessage] = useState('');
  const [transferError, setTransferError] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dataSummary, setDataSummary] = useState({
    transactions: 0,
    users: 0,
    categories: 0,
    accounts: 0,
    loans: 0,
    goals: 0,
    transactionHistory: 0,
    rentHistory: 0,
  });

  useEffect(() => {
    (async () => {
      await loadSettings();
      await loadCategories();
      await loadAccounts();
      await loadDataSummary();
    })();
  }, []);

  const loadSettings = async () => {
    const loadedSettings = await getSettings() as AppSettings;
    setSettings({
      ...loadedSettings,
      softwareName: (loadedSettings as AppSettings & { softwareName?: string }).softwareName || 'Expense Tracker'
    });
  };

  const loadCategories = async () => {
    const loadedCategories = await getCategories();
    setCategories(loadedCategories);
  };

  const loadAccounts = async () => {
    const loadedAccounts = await getAccounts();
    setAccounts(loadedAccounts);
  };

  const loadDataSummary = async () => {
    const [txns, usrs, cats, accs, lns, gls, txHistory, rentHist] = await Promise.all([
      getTransactions(),
      getUsers(),
      getCategories(),
      getAccounts(),
      getLoans(),
      getGoals(),
      getTransactionHistory(),
      getRentHistory(),
    ]);

    // Count usage of categories in existing transactions
    const usage: Record<string, number> = {};
    txns.forEach((t) => {
      const cid = t.categoryId || (t as unknown as { category_id?: string }).category_id;
      if (cid) usage[cid] = (usage[cid] || 0) + 1;
    });
    setCategoryUsage(usage);

    setDataSummary({
      transactions: txns.length,
      users: usrs.length,
      categories: cats.length,
      accounts: accs.length,
      loans: lns.length,
      goals: gls.length,
      transactionHistory: txHistory.length,
      rentHistory: rentHist.length,
    });
  };

  const handleSaveSettings = async () => {
    await saveSettings(settings);
    setMessage('Settings saved successfully!');
    setTimeout(() => setMessage(''), 3000);
    onDataChange();
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      await apiClient.createCategory({ name: newCategoryName.trim() });
      setNewCategoryName('');
      setError('');
      setMessage('Category added successfully!');
      setTimeout(() => setMessage(''), 3000);
      await loadCategories();
      await loadDataSummary();
      onDataChange();
    } catch (err) {
      setError((err as Error).message || 'Failed to add category');
    }
  };

  const handleEditCategory = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
      setEditingCategory(categoryId);
      setEditCategoryName(category.name);
    }
  };

  const handleSaveCategory = async () => {
    if (!editCategoryName.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      await apiClient.updateCategory(editingCategory!, { name: editCategoryName.trim() });
      setEditingCategory(null);
      setEditCategoryName('');
      setError('');
      setMessage('Category updated successfully!');
      setTimeout(() => setMessage(''), 3000);
      await loadCategories();
      await loadDataSummary();
      onDataChange();
    } catch (err) {
      setError((err as Error).message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId);
    const count = categoryUsage[categoryId] || 0;
    const confirmMsg = count > 0
      ? `Are you sure you want to delete "${category?.name || 'this category'}"? It is currently used in ${count} transaction(s). Your transactions will not be lost and will remain safely preserved as Uncategorized.`
      : `Are you sure you want to delete "${category?.name || 'this category'}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await apiClient.deleteCategory(categoryId);
      setError('');
      setMessage('Category deleted successfully!');
      setTimeout(() => setMessage(''), 3000);
      await loadCategories();
      await loadDataSummary();
      onDataChange();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete category');
    }
  };

  // Account Handlers
  const handleAddAccount = async () => {
    if (!newAccountData.name.trim()) {
      setError('Account name is required');
      return;
    }

    try {
      await apiClient.createAccount({
        name: newAccountData.name.trim(),
        type: newAccountData.type,
        account_number: newAccountData.accountNumber.trim() || null,
        initial_balance: parseFloat(newAccountData.initialBalance) || 0,
        color: newAccountData.color,
        bank_name: bankNameFor(newAccountData.bankId),
      });
      setNewAccountData({
        name: '',
        type: 'bank',
        accountNumber: '',
        initialBalance: '',
        color: '#4ECDC4',
        bankId: '',
      });
      setError('');
      setMessage('Account added successfully!');
      setTimeout(() => setMessage(''), 3000);
      await loadAccounts();
      await loadDataSummary();
      onDataChange();
    } catch (err) {
      setError((err as Error).message || 'Failed to add account');
    }
  };

  const handleEditAccount = (acc: Account) => {
    setEditingAccount(acc.id);
    setEditAccountData({
      name: acc.name,
      type: acc.type,
      accountNumber: acc.accountNumber || '',
      initialBalance: String(acc.initialBalance ?? 0),
      color: acc.color || '#4ECDC4',
      bankId: matchBank(acc.name, acc.bankName)?.id ?? (acc.type === 'cash' ? 'cash' : ''),
    });
  };

  const handleSaveAccount = async () => {
    if (!editAccountData.name.trim()) {
      setError('Account name is required');
      return;
    }

    try {
      await apiClient.updateAccount(editingAccount!, {
        name: editAccountData.name.trim(),
        type: editAccountData.type,
        account_number: editAccountData.accountNumber.trim() || null,
        initial_balance: parseFloat(editAccountData.initialBalance) || 0,
        color: editAccountData.color,
        bank_name: bankNameFor(editAccountData.bankId),
      });
      setEditingAccount(null);
      setError('');
      setMessage('Account updated successfully!');
      setTimeout(() => setMessage(''), 3000);
      await loadAccounts();
      await loadDataSummary();
      onDataChange();
    } catch (err) {
      setError((err as Error).message || 'Failed to update account');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!window.confirm(`Are you sure you want to delete "${acc?.name || 'this account'}"? Any transactions linked to this account will remain completely safe.`)) return;

    try {
      await apiClient.deleteAccount(accountId);
      setError('');
      setMessage('Account deleted successfully!');
      setTimeout(() => setMessage(''), 3000);
      await loadAccounts();
      await loadDataSummary();
      onDataChange();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete account');
    }
  };

  const handleTransfer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTransferError('');
    setTransferMessage('');

    if (!transferData.fromAccountId || !transferData.toAccountId) {
      setTransferError('Please select both From and To accounts.');
      return;
    }
    if (transferData.fromAccountId === transferData.toAccountId) {
      setTransferError('Source and Destination accounts must be different.');
      return;
    }
    const amt = parseFloat(transferData.amount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('Please enter a valid amount greater than 0.');
      return;
    }

    const fromAcc = accounts.find(a => a.id === transferData.fromAccountId);
    const toAcc = accounts.find(a => a.id === transferData.toAccountId);

    setTransferSubmitting(true);
    try {
      await apiClient.transferFunds({
        from_account_id: transferData.fromAccountId,
        to_account_id: transferData.toAccountId,
        amount: amt,
        date: transferData.date ? new Date(transferData.date).toISOString() : new Date().toISOString(),
        notes: transferData.notes || undefined,
      });

      setTransferMessage(`Successfully transferred ${formatCurrency(amt)} from ${fromAcc?.name || 'account'} to ${toAcc?.name || 'account'}.`);
      setTransferData({
        fromAccountId: '',
        toAccountId: '',
        amount: '',
        date: getDhakaDateInputValue(),
        notes: '',
      });
      await loadAccounts();
      await loadDataSummary();
      onDataChange();
    } catch (err) {
      setTransferError(`Transfer failed: ${(err as Error).message}`);
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleSwapTransferAccounts = () => {
    setTransferData(prev => ({
      ...prev,
      fromAccountId: prev.toAccountId,
      toAccountId: prev.fromAccountId,
    }));
  };

  const handleQuickTransferFrom = (accountId: string) => {
    const otherAccount = accounts.find(a => a.id !== accountId);
    setTransferData(prev => ({
      ...prev,
      fromAccountId: accountId,
      toAccountId: prev.toAccountId === accountId ? (otherAccount?.id || '') : prev.toAccountId || (otherAccount?.id || ''),
    }));
    const transferCard = document.getElementById('transfer-card');
    if (transferCard) {
      transferCard.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleExportData = async () => {
    try {
      await exportAllData();
      setMessage('Data exported successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setError('Failed to export data');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Importing will REPLACE all your current data (accounts, transactions, loans, goals, categories, users, settings and additional info) with the data in this backup file. Continue?')) {
      event.target.value = '';
      return;
    }

    importData(file)
      .then(() => {
        setMessage('Data imported successfully!');
        loadSettings();
        loadCategories();
        loadAccounts();
        loadDataSummary();
        onDataChange();
        setTimeout(() => setMessage(''), 3000);
      })
      .catch(() => {
        setError('Failed to import data');
        setTimeout(() => setError(''), 3000);
      });

    // Reset input
    event.target.value = '';
  };

  const handleResetData = () => {
    if (window.confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
      resetAllData();
      loadSettings();
      loadCategories();
      loadDataSummary();
      onDataChange();
      setMessage('All data has been reset');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <>
      <ControlPanel title="Settings" />
      <Tabs defaultValue="general" orientation="vertical" className="flex flex-col md:flex-row">
        <TabsList className="h-auto shrink-0 overflow-x-auto bg-card px-2 pt-2 md:min-h-[calc(100vh-6.5rem)] md:w-56 md:flex-col md:items-stretch md:gap-0.5 md:border-b-0 md:border-r md:p-2">
          <TabsTrigger value="general" className="md:w-full md:justify-start md:rounded-md md:border-transparent md:mb-0 md:data-[state=active]:border-transparent md:data-[state=active]:bg-accent md:data-[state=active]:text-accent-foreground">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="accounts" className="md:w-full md:justify-start md:rounded-md md:border-transparent md:mb-0 md:data-[state=active]:border-transparent md:data-[state=active]:bg-accent md:data-[state=active]:text-accent-foreground">
            <Landmark className="h-4 w-4" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="categories" className="md:w-full md:justify-start md:rounded-md md:border-transparent md:mb-0 md:data-[state=active]:border-transparent md:data-[state=active]:bg-accent md:data-[state=active]:text-accent-foreground">
            <Tags className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="users" className="md:w-full md:justify-start md:rounded-md md:border-transparent md:mb-0 md:data-[state=active]:border-transparent md:data-[state=active]:bg-accent md:data-[state=active]:text-accent-foreground">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="data" className="md:w-full md:justify-start md:rounded-md md:border-transparent md:mb-0 md:data-[state=active]:border-transparent md:data-[state=active]:bg-accent md:data-[state=active]:text-accent-foreground">
            <Download className="h-4 w-4" />
            Data
          </TabsTrigger>
        </TabsList>

        <div className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
        {message && (
          <Alert className="mt-4">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="softwareName">Software Name</Label>
                  <Input
                    id="softwareName"
                    value={settings.softwareName}
                    onChange={(e) => setSettings({ ...settings, softwareName: e.target.value })}
                    placeholder="Enter software name"
                  />
                  <p className="text-xs text-muted-foreground mt-1">This name will appear on vouchers and reports</p>
                </div>

                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={settings.currency} onValueChange={(value) => setSettings({ ...settings, currency: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.symbol} {currency.name} ({currency.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select value={settings.dateFormat} onValueChange={(value) => setSettings({ ...settings, dateFormat: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select date format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={settings.theme} onValueChange={(value) => setSettings({ ...settings, theme: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notifications">Enable Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified about important events</p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={settings.notifications}
                    onCheckedChange={(checked) => setSettings({ ...settings, notifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoBackup">Auto Backup</Label>
                    <p className="text-sm text-muted-foreground">Automatically backup data daily</p>
                  </div>
                  <Switch
                    id="autoBackup"
                    checked={settings.autoBackup}
                    onCheckedChange={(checked) => setSettings({ ...settings, autoBackup: checked })}
                  />
                </div>
              </div>

              <Button onClick={handleSaveSettings} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <UsersTab onDataChange={onDataChange} embedded />
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          {/* Accounts Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Funds (All Accounts)</p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatCurrency(accounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0))}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bank Accounts</p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatCurrency(accounts.filter(a => a.type === 'bank' || a.type === 'savings').reduce((sum, a) => sum + (a.currentBalance ?? 0), 0))}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cash in Hand</p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatCurrency(accounts.filter(a => a.type === 'cash').reduce((sum, a) => sum + (a.currentBalance ?? 0), 0))}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mobile Wallets</p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatCurrency(accounts.filter(a => a.type === 'mobile_wallet').reduce((sum, a) => sum + (a.currentBalance ?? 0), 0))}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transfer Money Between Accounts Card */}
          <Card id="transfer-card">
            <CardHeader className="pb-3">
              <CardTitle>
                Transfer between accounts
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Your total balance stays the same.
              </p>
            </CardHeader>
            <CardContent>
              {transferMessage && (
                <Alert className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-200">
                  <Check className="h-4 w-4 text-emerald-600 mr-2" />
                  <AlertDescription>{transferMessage}</AlertDescription>
                </Alert>
              )}
              {transferError && (
                <Alert className="mb-4 bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-800 dark:text-rose-200">
                  <AlertDescription>{transferError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-end">
                  {/* From Account */}
                  <div className="md:col-span-4">
                    <Label htmlFor="fromAcc" className="text-xs font-semibold">From Account (Source) *</Label>
                    <Select
                      value={transferData.fromAccountId}
                      onValueChange={(val) => setTransferData({ ...transferData, fromAccountId: val })}
                    >
                      <SelectTrigger id="fromAcc" className="mt-1 bg-background">
                        <SelectValue placeholder="Select Source Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id} disabled={acc.id === transferData.toAccountId}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="flex items-center gap-2"><AccountAvatar name={acc.name} bankName={acc.bankName} color={acc.color} size="xs" />{acc.name}</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatCurrency(Number(acc.currentBalance ?? acc.balance ?? 0))}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Swap Button */}
                  <div className="md:col-span-1 flex justify-center pb-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleSwapTransferAccounts}
                      disabled={!transferData.fromAccountId && !transferData.toAccountId}
                      className="h-10 w-10 rounded-full border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                      title="Swap Source and Destination"
                    >
                      <ArrowLeftRight className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </Button>
                  </div>

                  {/* To Account */}
                  <div className="md:col-span-4">
                    <Label htmlFor="toAcc" className="text-xs font-semibold">To Account (Destination) *</Label>
                    <Select
                      value={transferData.toAccountId}
                      onValueChange={(val) => setTransferData({ ...transferData, toAccountId: val })}
                    >
                      <SelectTrigger id="toAcc" className="mt-1 bg-background">
                        <SelectValue placeholder="Select Destination Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id} disabled={acc.id === transferData.fromAccountId}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="flex items-center gap-2"><AccountAvatar name={acc.name} bankName={acc.bankName} color={acc.color} size="xs" />{acc.name}</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatCurrency(Number(acc.currentBalance ?? acc.balance ?? 0))}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount */}
                  <div className="md:col-span-2">
                    <Label htmlFor="transferAmt" className="text-xs font-semibold">Amount *</Label>
                    <Input
                      id="transferAmt"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      className="mt-1 bg-background"
                      value={transferData.amount}
                      onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Additional Row: Date, Notes & Submit */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-1">
                  <div>
                    <Label htmlFor="transferDate" className="text-xs font-semibold">Date</Label>
                    <Input
                      id="transferDate"
                      type="date"
                      className="mt-1 bg-background"
                      value={transferData.date}
                      onChange={(e) => setTransferData({ ...transferData, date: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="transferNotes" className="text-xs font-semibold">Notes / Purpose (Optional)</Label>
                    <Input
                      id="transferNotes"
                      placeholder="e.g. ATM withdrawal, Bank to bKash add money"
                      className="mt-1 bg-background"
                      value={transferData.notes}
                      onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                    />
                  </div>

                  <div>
                    <Button
                      type="submit"
                      disabled={transferSubmitting || !transferData.fromAccountId || !transferData.toAccountId || !transferData.amount}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      {transferSubmitting ? 'Transferring...' : 'Transfer Now'}
                    </Button>
                  </div>
                </div>

                {/* Projected Balance Preview Box */}
                {(() => {
                  const fromAcc = accounts.find(a => a.id === transferData.fromAccountId);
                  const toAcc = accounts.find(a => a.id === transferData.toAccountId);
                  const amt = parseFloat(transferData.amount) || 0;

                  if (!fromAcc && !toAcc) return null;

                  const fromOld = fromAcc?.currentBalance ?? fromAcc?.balance ?? 0;
                  const fromNew = fromOld - amt;
                  const toOld = toAcc?.currentBalance ?? toAcc?.balance ?? 0;
                  const toNew = toOld + amt;

                  return (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-4">
                      {fromAcc && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Source:</span>
                          <span className="font-semibold">{fromAcc.name}</span>
                          <span className="text-muted-foreground">({formatCurrency(fromOld)})</span>
                          {amt > 0 && (
                            <>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className={`font-bold ${fromNew >= 0 ? 'text-foreground' : 'text-rose-600'}`}>
                                {formatCurrency(fromNew)}
                              </span>
                              <span className="text-rose-600 font-mono">(-{formatCurrency(amt)})</span>
                            </>
                          )}
                        </div>
                      )}
                      {toAcc && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Destination:</span>
                          <span className="font-semibold">{toAcc.name}</span>
                          <span className="text-muted-foreground">({formatCurrency(toOld)})</span>
                          {amt > 0 && (
                            <>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-bold text-emerald-600">
                                {formatCurrency(toNew)}
                              </span>
                              <span className="text-emerald-600 font-mono">(+{formatCurrency(amt)})</span>
                            </>
                          )}
                        </div>
                      )}
                      <div className="text-muted-foreground italic">
                        Total Balance: <span className="font-medium text-foreground">unchanged</span>
                      </div>
                    </div>
                  );
                })()}
              </form>
            </CardContent>
          </Card>

          {/* Add Account Card */}
          <Card>
            <CardHeader>
              <CardTitle>New account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="accBank">Bank or wallet</Label>
                  <BankPicker
                    id="accBank"
                    value={newAccountData.bankId}
                    onChange={(choice) => setNewAccountData(applyBankChoice(newAccountData, choice))}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="accName">Account name</Label>
                  <Input
                    id="accName"
                    placeholder="For example, MTB salary account"
                    value={newAccountData.name}
                    onChange={(e) => setNewAccountData({ ...newAccountData, name: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddAccount()}
                  />
                </div>

                <div>
                  <Label htmlFor="accType">Type</Label>
                  <Select
                    value={newAccountData.type}
                    onValueChange={(val: Account['type']) => setNewAccountData({ ...newAccountData, type: val })}
                  >
                    <SelectTrigger id="accType">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank Account</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mobile_wallet">Mobile Wallet (bKash/Nagad)</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="savings">Savings Account</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="accInitBal">Opening Balance</Label>
                  <Input
                    id="accInitBal"
                    type="number"
                    placeholder="0.00"
                    value={newAccountData.initialBalance}
                    onChange={(e) => setNewAccountData({ ...newAccountData, initialBalance: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddAccount()}
                  />
                </div>

                <div>
                  <Label htmlFor="accNum">Account No (Opt.)</Label>
                  <Input
                    id="accNum"
                    placeholder="e.g. 1023..."
                    value={newAccountData.accountNumber}
                    onChange={(e) => setNewAccountData({ ...newAccountData, accountNumber: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddAccount()}
                  />
                </div>
              </div>

              <Button onClick={handleAddAccount} className="mt-4 w-full md:w-auto">
                <Plus className="h-4 w-4" aria-hidden />
                Add account
              </Button>
            </CardContent>
          </Card>

          {/* Manage Accounts List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                Manage Accounts ({accounts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {accounts.map((acc) => {
                const isEditing = editingAccount === acc.id;

                return (
                  <div
                    key={acc.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-muted dark:bg-gray-800/50 rounded-lg border border-border gap-4"
                  >
                    {isEditing ? (
                      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-5">
                        <div>
                          <Label className="text-xs">Bank or wallet</Label>
                          <BankPicker
                            value={editAccountData.bankId}
                            onChange={(choice) => setEditAccountData(applyBankChoice(editAccountData, choice))}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Account Name</Label>
                          <Input
                            value={editAccountData.name}
                            onChange={(e) => setEditAccountData({ ...editAccountData, name: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={editAccountData.type}
                            onValueChange={(val: Account['type']) => setEditAccountData({ ...editAccountData, type: val })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bank">Bank Account</SelectItem>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="mobile_wallet">Mobile Wallet</SelectItem>
                              <SelectItem value="credit_card">Credit Card</SelectItem>
                              <SelectItem value="savings">Savings Account</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Opening Balance</Label>
                          <Input
                            type="number"
                            value={editAccountData.initialBalance}
                            onChange={(e) => setEditAccountData({ ...editAccountData, initialBalance: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Account No.</Label>
                          <Input
                            value={editAccountData.accountNumber}
                            onChange={(e) => setEditAccountData({ ...editAccountData, accountNumber: e.target.value })}
                            className="h-9"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <AccountAvatar name={acc.name} bankName={acc.bankName} color={acc.color} size="lg" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">{acc.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 capitalize font-medium">
                              {acc.type ? acc.type.replace('_', ' ') : 'bank'}
                            </span>
                            {acc.accountNumber && (
                              <span className="text-xs text-muted-foreground font-mono">
                                #{acc.accountNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Opening balance: {formatCurrency(acc.initialBalance || 0)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between md:justify-end gap-4">
                      {!isEditing && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Current Balance</p>
                          <p className={`text-lg font-bold ${(acc.currentBalance ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(acc.currentBalance ?? 0)}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={handleSaveAccount}>
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingAccount(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-medium border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                              onClick={() => handleQuickTransferFrom(acc.id)}
                              title="Transfer money from this account"
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                              Transfer
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleEditAccount(acc)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteAccount(acc.id)}>
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {accounts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No accounts configured yet. Add an account above.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Manage Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <Button onClick={handleAddCategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/70 dark:bg-card dark:hover:bg-accent/40 rounded-lg border border-border transition-colors duration-150"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-background"
                        style={{ backgroundColor: category.color }}
                      />
                      {editingCategory === category.id ? (
                        <Input
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSaveCategory()}
                          className="h-8 max-w-sm"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-medium text-foreground text-sm truncate">
                            {category.name}
                          </span>
                          {categoryUsage[category.id] !== undefined && categoryUsage[category.id] > 0 ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 dark:border dark:border-blue-800/40 font-medium">
                              {categoryUsage[category.id]} {categoryUsage[category.id] === 1 ? 'transaction' : 'transactions'}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-normal">
                              0 transactions
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {editingCategory === category.id ? (
                        <>
                          <Button size="sm" onClick={handleSaveCategory} className="h-8 px-2.5">
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)} className="h-8 px-2.5">
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditCategory(category.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit category"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCategory(category.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                            title="Delete category"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {categories.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Tags className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No categories created yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div>
                  <h3 className="font-medium">Backup Preview</h3>
                  <p className="text-sm text-muted-foreground">
                    Export includes every record stored for the current signed-in user.
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-muted-foreground">Accounts</p>
                    <p className="text-xl font-semibold">{dataSummary.accounts}</p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-muted-foreground">Transactions</p>
                    <p className="text-xl font-semibold">{dataSummary.transactions}</p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-muted-foreground">Users</p>
                    <p className="text-xl font-semibold">{dataSummary.users}</p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-muted-foreground">Categories</p>
                    <p className="text-xl font-semibold">{dataSummary.categories}</p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-muted-foreground">Loans</p>
                    <p className="text-xl font-semibold">{dataSummary.loans}</p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-muted-foreground">Goals</p>
                    <p className="text-xl font-semibold">{dataSummary.goals}</p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-muted-foreground">Transaction History</p>
                    <p className="text-xl font-semibold">{dataSummary.transactionHistory}</p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-muted-foreground">Rent History</p>
                    <p className="text-xl font-semibold">{dataSummary.rentHistory}</p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-muted-foreground">Settings</p>
                    <p className="text-xl font-semibold">1</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button onClick={handleExportData} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>

                <div>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="hidden"
                    id="import-file"
                  />
                  <Button asChild variant="outline" className="w-full">
                    <Label htmlFor="import-file" className="cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" />
                      Import Data
                    </Label>
                  </Button>
                </div>

                <Button onClick={handleResetData} variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Reset All Data
                </Button>
              </div>

              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>Export Data:</strong> Download one JSON backup with everything: accounts (Cash, Bank, Mobile Wallets and opening balances), transactions and transfers, loans, goals, users, categories, settings, and additional info.</p>
                <p><strong>Import Data:</strong> Upload a previously exported JSON file to restore all of it together. Account balances are recalculated exactly as they were.</p>
                <p><strong>Reset All Data:</strong> Permanently delete all transactions, users, categories, and settings.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </div>
      </Tabs>
    </>
  );
}
