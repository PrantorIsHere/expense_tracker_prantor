import { useState, useEffect } from 'react';
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
  getTransactions,
  getUsers,
  getLoans,
  getGoals,
  exportAllData,
  importData,
  resetAllData
} from '@/lib/storage';
import { apiClient } from '@/lib/api';
import { getTransactionHistory, getRentHistory } from '@/lib/additionalInfoStorage';
import { SUPPORTED_CURRENCIES } from '@/lib/currencyUtils';
import UsersTab from './UsersTab';
import { Category } from '@/components/types';
import { 
  Settings, 
  Users, 
  Tags, 
  Download, 
  Upload, 
  Trash2, 
  Plus,
  Edit2,
  Save
} from 'lucide-react';

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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dataSummary, setDataSummary] = useState({
    transactions: 0,
    users: 0,
    categories: 0,
    loans: 0,
    goals: 0,
    transactionHistory: 0,
    rentHistory: 0,
  });

  useEffect(() => {
    (async () => {
      await loadSettings();
      await loadCategories();
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

  const loadDataSummary = async () => {
    const [txns, usrs, cats, lns, gls, txHistory, rentHist] = await Promise.all([
      getTransactions(),
      getUsers(),
      getCategories(),
      getLoans(),
      getGoals(),
      getTransactionHistory(),
      getRentHistory(),
    ]);
    setDataSummary({
      transactions: txns.length,
      users: usrs.length,
      categories: cats.length,
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
      await loadCategories();
      await loadDataSummary();
      onDataChange();
    } catch (err) {
      setError((err as Error).message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await apiClient.deleteCategory(categoryId);
      await loadCategories();
      await loadDataSummary();
      onDataChange();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete category');
    }
  };

  const handleExportData = () => {
    try {
      exportAllData();
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

    importData(file)
      .then(() => {
        setMessage('Data imported successfully!');
        loadSettings();
        loadCategories();
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
    <div className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">
            <Settings className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tags className="mr-2 h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="data">
            <Download className="mr-2 h-4 w-4" />
            Data
          </TabsTrigger>
        </TabsList>

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
                  <p className="text-xs text-gray-500 mt-1">This name will appear on vouchers and reports</p>
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
                    <p className="text-sm text-gray-600">Get notified about important events</p>
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
                    <p className="text-sm text-gray-600">Automatically backup data daily</p>
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
          <UsersTab onDataChange={onDataChange} />
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
                  <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {editingCategory === category.id ? (
                        <Input
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSaveCategory()}
                          className="h-8"
                        />
                      ) : (
                        <span>{category.name}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {editingCategory === category.id ? (
                        <Button size="sm" onClick={handleSaveCategory}>
                          <Save className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleEditCategory(category.id)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteCategory(category.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {categories.length === 0 && (
                <div className="text-center py-8 text-gray-500">
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

              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>Export Data:</strong> Download transactions, users, categories, loans, goals, settings, and additional info as a JSON backup.</p>
                <p><strong>Import Data:</strong> Upload a previously exported JSON file to restore your data.</p>
                <p><strong>Reset All Data:</strong> Permanently delete all transactions, users, categories, and settings.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
