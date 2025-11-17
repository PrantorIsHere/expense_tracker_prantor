import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Sidebar from '@/components/Sidebar';
import TransactionManager from '@/components/TransactionManager';
import ReportsPage from '@/components/ReportsPage';
import LoansManager from '@/components/LoansManager';
import SettingsPage from '@/components/SettingsPage';
import UsersTab from '@/components/UsersTab';
import UserHeader from '@/components/UserHeader';
import AdditionalInfoTab from '@/components/AdditionalInfoTab';
import { getTransactions, getUsers, getCategories, getLoans, getGoals, formatCurrency } from '@/lib/storage';
import { getCurrentSession, isAdmin } from '@/lib/auth';
import { Transaction, User, Category, Loan, Goal } from '@/types';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users as UsersIcon,
  Target,
  PieChart,
  Calendar,
  CreditCard
} from 'lucide-react';

export default function Index() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const session = getCurrentSession();
  const isAdminUser = isAdmin();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTransactions(getTransactions());
    setUsers(getUsers());
    setCategories(getCategories());
    setLoans(getLoans());
    setGoals(getGoals());
  };

  // Calculate financial metrics
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  const thisMonthTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    const now = new Date();
    return transactionDate.getMonth() === now.getMonth() &&
           transactionDate.getFullYear() === now.getFullYear();
  });

  const monthlyIncome = thisMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpenses = thisMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalLoansGiven = loans
    .filter(l => l.type === 'given' && l.status === 'active')
    .reduce((sum, l) => sum + l.amount, 0);

  const totalLoansTaken = loans
    .filter(l => l.type === 'taken' && l.status === 'active')
    .reduce((sum, l) => sum + l.amount, 0);

  const completedGoals = goals.filter(g => g.currentAmount >= g.targetAmount).length;
  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount).length;

  const recentTransactions = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'transactions' && 'Transaction Manager'}
                {activeTab === 'reports' && 'Financial Reports'}
                {activeTab === 'loans' && 'Loans Manager'}
                {activeTab === 'users' && 'User Management'}
                {activeTab === 'settings' && 'Settings'}
                {activeTab === 'additional' && 'Additional Info'}
              </h1>
              <p className="text-gray-600 mt-1">
                {activeTab === 'dashboard' && `Welcome back, ${session?.username}! Here's your financial overview.`}
                {activeTab === 'transactions' && 'Manage your income and expenses'}
                {activeTab === 'reports' && 'Analyze your financial data'}
                {activeTab === 'loans' && 'Track loans given and taken'}
                {activeTab === 'users' && 'Manage account users and financial users'}
                {activeTab === 'settings' && 'Configure your preferences'}
                {activeTab === 'additional' && 'Manage additional history and export combined PDF reports'}
              </p>
            </div>
            <UserHeader />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="dashboard" className="space-y-6">
              {/* Financial Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(balance)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {balance >= 0 ? '+' : ''}{formatCurrency(balance - (totalIncome - totalExpenses))} from last period
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(monthlyIncome)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This month's earnings
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(monthlyExpenses)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This month's spending
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
                    <Target className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {activeGoals}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {completedGoals} completed
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Loans Given</CardTitle>
                    <CreditCard className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-orange-600">
                      {formatCurrency(totalLoansGiven)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Loans Taken</CardTitle>
                    <CreditCard className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-purple-600">
                      {formatCurrency(totalLoansTaken)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Financial Users</CardTitle>
                    <UsersIcon className="h-4 w-4 text-gray-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-gray-600">
                      {users.length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Recent Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentTransactions.length > 0 ? (
                    <div className="space-y-3">
                      {recentTransactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              transaction.type === 'income' ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                            <div>
                              <p className="font-medium">{transaction.description}</p>
                              <p className="text-sm text-gray-600">
                                {users.find(u => u.id === transaction.userId)?.name} • {transaction.category}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(transaction.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No transactions yet</p>
                      <Button
                        variant="outline"
                        className="mt-2"
                        onClick={() => setActiveTab('transactions')}
                      >
                        Add Transaction
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Admin Section */}
              {isAdminUser && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UsersIcon className="h-5 w-5" />
                      Admin Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{users.length}</p>
                        <p className="text-sm text-blue-700">Financial Users</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{transactions.length}</p>
                        <p className="text-sm text-green-700">Total Transactions</p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-600">{categories.length}</p>
                        <p className="text-sm text-purple-700">Categories</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="transactions">
              <TransactionManager onDataChange={loadData} />
            </TabsContent>

            <TabsContent value="reports">
              <ReportsPage />
            </TabsContent>

            <TabsContent value="loans">
              <LoansManager onDataChange={loadData} />
            </TabsContent>

            <TabsContent value="users">
              <UsersTab onDataChange={loadData} />
            </TabsContent>

            <TabsContent value="settings">
              <SettingsPage onDataChange={loadData} />
            </TabsContent>

            <TabsContent value="additional">
              <AdditionalInfoTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}