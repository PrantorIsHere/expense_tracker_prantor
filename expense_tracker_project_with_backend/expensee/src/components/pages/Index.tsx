import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Sidebar from '@/components/Sidebar';
import TransactionManager from '@/components/TransactionManager';
import ReportsPage from '@/components/ReportsPage';
import LoansManager from '@/components/LoansManager';
import GoalsManager from '@/components/GoalsManager';
import SettingsPage from '@/components/SettingsPage';
import UsersTab from '@/components/UsersTab';
import UserHeader from '@/components/UserHeader';
import AdditionalInfoTab from '@/components/AdditionalInfoTab';
import { getTransactions, getUsers, getCategories, getLoans, getGoals, formatCurrency } from '@/lib/storage';
import { getCurrentSession, isAdmin } from '@/lib/auth';
import { Transaction, User, Category, Loan, Goal } from '@/components/types';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users as UsersIcon,
  Target,
  PieChart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
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
  const monthlySavings = monthlyIncome - monthlyExpenses;
  const expenseRatio = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 0;

  // Calculate loan statistics - ONLY PENDING LOANS (matching Loans page)
  const pendingLoans = loans.filter(l => l.status === 'pending');
  
  const outstandingGiven = pendingLoans
    .filter(l => l.type === 'given')
    .reduce((sum, l) => sum + l.amount, 0);

  const outstandingTaken = pendingLoans
    .filter(l => l.type === 'taken')
    .reduce((sum, l) => sum + l.amount, 0);

  const netPosition = outstandingGiven - outstandingTaken;

  // Goals calculations
  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const totalGoalTarget = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalGoalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallGoalProgress = totalGoalTarget > 0 ? (totalGoalSaved / totalGoalTarget) * 100 : 0;

  // Daily savings rate (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentTransactions = transactions.filter(t => new Date(t.date) >= thirtyDaysAgo);
  const recentIncome = recentTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const recentExpenses = recentTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const dailySavings = (recentIncome - recentExpenses) / 30;

  const recentTransactionsList = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingLoansCount={pendingLoans.length}
        activeGoalsCount={activeGoals.length}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card/80 backdrop-blur-lg shadow-lg border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold gradient-text">
                {activeTab === 'dashboard' && '📊 Dashboard'}
                {activeTab === 'transactions' && '💳 Transaction Manager'}
                {activeTab === 'goals' && '🎯 Savings Goals'}
                {activeTab === 'reports' && '📈 Financial Reports'}
                {activeTab === 'loans' && '💰 Loans Manager'}
                {activeTab === 'users' && '👥 User Management'}
                {activeTab === 'settings' && '⚙️ Settings'}
                {activeTab === 'additional' && 'ℹ️ Additional Info'}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {activeTab === 'dashboard' && `Welcome back, ${session?.username}! Here's your financial overview.`}
                {activeTab === 'transactions' && 'Manage your income and expenses'}
                {activeTab === 'goals' && 'Track your savings goals and smart insights'}
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
                <Card className="border-border bg-gradient-to-br from-card to-card/50 hover:shadow-2xl transition-all duration-300 hover-lift card-animate overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl" />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-card-foreground">Total Balance</CardTitle>
                    <div className="p-2 rounded-lg bg-primary/10">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className={`text-3xl font-bold ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(balance)}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                      {balance >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      Overall financial status
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-green-500/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-full blur-3xl" />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-card-foreground">Monthly Income</CardTitle>
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(monthlyIncome)}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                      <ArrowUpRight className="h-3 w-3" />
                      This month's earnings
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-red-500/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/20 to-transparent rounded-full blur-3xl" />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-card-foreground">Monthly Expenses</CardTitle>
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(monthlyExpenses)}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                      <ArrowDownRight className="h-3 w-3" />
                      This month's spending
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-emerald-500/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full blur-3xl" />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-card-foreground">Monthly Savings</CardTitle>
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <PiggyBank className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className={`text-3xl font-bold ${monthlySavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(Math.abs(monthlySavings))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {monthlySavings >= 0 ? 'Saved this month' : 'Overspent this month'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-amber-500/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-3xl" />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-card-foreground">Expense Ratio</CardTitle>
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <PieChart className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className={`text-3xl font-bold ${expenseRatio <= 100 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {expenseRatio.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      This month's expense vs income
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-green-500/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-full blur-3xl" />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-card-foreground">Outstanding Given</CardTitle>
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(outstandingGiven)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Amount you lent (pending repayment)
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-red-500/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/20 to-transparent rounded-full blur-3xl" />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-card-foreground">Outstanding Taken</CardTitle>
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(outstandingTaken)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Amount you borrowed (pending repayment)
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-blue-500/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-3xl" />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-card-foreground">Net Position</CardTitle>
                    <Badge variant={netPosition >= 0 ? "default" : "destructive"} className="ml-auto">
                      {netPosition >= 0 ? 'You are owed' : 'You owe'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className={`text-3xl font-bold ${netPosition >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(Math.abs(netPosition))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Net outstanding amount
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Goals Overview + Quick Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-border bg-gradient-to-br from-purple-500/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate cursor-pointer" onClick={() => setActiveTab('goals')}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-card-foreground">Savings Goals</CardTitle>
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {activeGoals.length} Active
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {completedGoals.length} completed
                    </p>
                    {activeGoals.length > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span>{formatCurrency(totalGoalSaved)}</span>
                          <span className="text-muted-foreground">{formatCurrency(totalGoalTarget)}</span>
                        </div>
                        <Progress value={overallGoalProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">{overallGoalProgress.toFixed(1)}% overall</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-orange-500/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-card-foreground">Daily Savings Rate</CardTitle>
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <PiggyBank className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${dailySavings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(Math.abs(dailySavings))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {dailySavings >= 0 ? 'saving' : 'overspending'} per day (avg 30d)
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-primary/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-card-foreground">Financial Users</CardTitle>
                    <div className="p-2 rounded-lg bg-primary/10">
                      <UsersIcon className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {users.length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Total registered users
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-primary/10 to-card hover:shadow-2xl transition-all duration-300 hover-lift card-animate">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-card-foreground">Categories</CardTitle>
                    <div className="p-2 rounded-lg bg-primary/10">
                      <PieChart className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {categories.length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Transaction categories
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Active Goals on Dashboard */}
              {activeGoals.length > 0 && (
                <Card className="border-border bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-card-foreground">
                        <Target className="h-5 w-5 text-purple-600" />
                        Active Savings Goals
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('goals')}>
                        View All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {activeGoals.slice(0, 3).map((goal) => {
                        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                        const remaining = goal.targetAmount - goal.currentAmount;
                        const deadlineDate = new Date(goal.deadline);
                        const now = new Date();
                        const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                        const dailyNeeded = daysRemaining > 0 ? remaining / daysRemaining : remaining;

                        return (
                          <div key={goal.id} className="p-4 bg-gradient-to-r from-muted/50 to-transparent rounded-xl border border-border/50 hover:shadow-md transition-all duration-300">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-purple-600" />
                                <span className="font-semibold">{goal.title}</span>
                              </div>
                              <Badge variant={
                                goal.priority === 'high' ? 'destructive' :
                                goal.priority === 'medium' ? 'default' : 'secondary'
                              }>
                                {goal.priority}
                              </Badge>
                            </div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{formatCurrency(goal.currentAmount)}</span>
                              <span className="text-muted-foreground">{formatCurrency(goal.targetAmount)}</span>
                            </div>
                            <Progress value={Math.min(progress, 100)} className="h-2 mb-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{progress.toFixed(1)}% • {formatCurrency(remaining)} remaining</span>
                              <span>
                                {daysRemaining > 0
                                  ? `${daysRemaining}d left • ${formatCurrency(dailyNeeded)}/day`
                                  : 'Deadline passed'
                                }
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Transactions */}
              <Card className="border-border bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Calendar className="h-5 w-5 text-primary" />
                    Recent Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentTransactionsList.length > 0 ? (
                    <div className="space-y-3">
                      {recentTransactionsList.map((transaction, index) => (
                        <div 
                          key={transaction.id} 
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/50 to-transparent rounded-xl hover:from-muted hover:to-muted/50 transition-all duration-300 border border-border/50 hover-lift"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              transaction.type === 'income' ? 'bg-green-500 pulse-subtle' : 'bg-red-500 pulse-subtle'
                            }`} />
                            <div>
                              <p className="font-semibold text-foreground">{transaction.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {users.find(u => u.id === transaction.userId)?.name} • {categories.find(c => c.id === transaction.categoryId)?.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-lg ${
                              transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(transaction.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <PieChart className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No transactions yet</p>
                      <p className="text-sm mb-4">Start tracking your finances today</p>
                      <Button
                        variant="default"
                        className="mt-2 hover-lift"
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
                <Card className="border-border bg-gradient-to-br from-primary/5 via-card to-card hover:shadow-xl transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-card-foreground">
                      <UsersIcon className="h-5 w-5 text-primary" />
                      Admin Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-6 bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-xl border border-blue-500/20 hover-lift">
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{users.length}</p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Financial Users</p>
                      </div>
                      <div className="text-center p-6 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl border border-green-500/20 hover-lift">
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">{transactions.length}</p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">Total Transactions</p>
                      </div>
                      <div className="text-center p-6 bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-xl border border-purple-500/20 hover-lift">
                        <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{goals.length}</p>
                        <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">Savings Goals</p>
                      </div>
                      <div className="text-center p-6 bg-gradient-to-br from-orange-500/20 to-orange-500/5 rounded-xl border border-orange-500/20 hover-lift">
                        <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{categories.length}</p>
                        <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">Categories</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="transactions">
              <TransactionManager onDataChange={loadData} />
            </TabsContent>

            <TabsContent value="goals">
              <GoalsManager onDataChange={loadData} />
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
