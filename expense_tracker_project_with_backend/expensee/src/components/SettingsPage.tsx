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
  getUsers, 
  saveUsers,
  getCategories, 
  saveCategories,
  exportAllData,
  importData,
  resetAllData
} from '@/lib/storage';
import { SUPPORTED_CURRENCIES } from '@/lib/currencyUtils';
import UsersTab from './UsersTab';
import { User, Category } from '@/types';
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

  useEffect(() => {
    loadSettings();
    loadCategories();
  }, []);

  const loadSettings = () => {
    const loadedSettings = getSettings() as AppSettings;
    setSettings({
      ...loadedSettings,
      softwareName: loadedSettings.softwareName || 'Expense Tracker'
    });
  };

  const loadCategories = () => {
    const loadedCategories = getCategories();
    setCategories(loadedCategories);
  };

  const handleSaveSettings = () => {
    saveSettings(settings);
    setMessage('Settings saved successfully!');
    setTimeout(() => setMessage(''), 3000);
    onDataChange();
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      setError('Category name is required');
      return;
    }

    const existingCategories = getCategories();
    if (existingCategories.some(cat => cat.name.toLowerCase() === newCategoryName.toLowerCase())) {
      setError('Category already exists');
      return;
    }

    const newCategory: Category = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.trim(),
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      createdAt: new Date().toISOString()
    };

    const updatedCategories = [...existingCategories, newCategory];
    saveCategories(updatedCategories);
    setNewCategoryName('');
    setError('');
    loadCategories();
    onDataChange();
  };

  const handleEditCategory = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
      setEditingCategory(categoryId);
      setEditCategoryName(category.name);
    }
  };

  const handleSaveCategory = () => {
    if (!editCategoryName.trim()) {
      setError('Category name is required');
      return;
    }

    const updatedCategories = categories.map(cat =>
      cat.id === editingCategory
        ? { ...cat, name: editCategoryName.trim() }
        : cat
    );

    saveCategories(updatedCategories);
    setEditingCategory(null);
    setEditCategoryName('');
    setError('');
    loadCategories();
    onDataChange();
  };

  const handleDeleteCategory = (categoryId: string) => {
    const updatedCategories = categories.filter(cat => cat.id !== categoryId);
    saveCategories(updatedCategories);
    loadCategories();
    onDataChange();
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
                <p><strong>Export Data:</strong> Download all your data as a JSON file for backup purposes.</p>
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