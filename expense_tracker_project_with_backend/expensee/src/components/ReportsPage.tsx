import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getTransactions, getCategories, getUsers, getLoans, formatCurrency } from '@/lib/storage';
import { Transaction, Category, User, Loan } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Target, DollarSign, Activity, Users as UsersIcon, FileText } from 'lucide-react';
import { generateCategoryBreakdownPDF } from '@/lib/lib/categoryBreakdownPDF';

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    setTransactions(getTransactions());
    setCategories(getCategories());
    setUsers(getUsers());
    setLoans(getLoans());
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ef4444', '#10b981', '#6366f1', '#f59e0b'];

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }),
    [transactions, currentMonth, currentYear]
  );

  const getCurrentMonthData = () => {
    const income = currentMonthTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = currentMonthTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netIncome = income - expenses;
    const savingsRate = income > 0 ? (netIncome / income) * 100 : 0;
    return { income, expenses, netIncome, savingsRate };
  };

  const getMonthlyTrend = () => {
    const monthlyData = [];
    const baseline = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(baseline.getFullYear(), baseline.getMonth() - i, 1);
      const monthTransactions = transactions.filter((t) => {
        const td = new Date(t.date);
        return td.getMonth() === date.getMonth() && td.getFullYear() === date.getFullYear();
      });

      const income = monthTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = monthTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

      monthlyData.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        income,
        expenses,
        net: income - expenses,
      });
    }

    return monthlyData;
  };

  // Build per-category stats using categories from Settings
  const categoryStats = useMemo(() => {
    const stats = categories.map((cat) => {
      const catTxs = transactions.filter((t) => t.categoryId === cat.id);
      const income = catTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = catTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const count = catTxs.length;
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        income,
        expense,
        net: income - expense,
        count,
      };
    });

    const totalIncome = stats.reduce((sum, s) => sum + s.income, 0);
    const totalExpense = stats.reduce((sum, s) => sum + s.expense, 0);

    return stats
      .map((s) => ({
        ...s,
        pctIncome: totalIncome > 0 ? (s.income / totalIncome) * 100 : 0,
        pctExpense: totalExpense > 0 ? (s.expense / totalExpense) * 100 : 0,
      }))
      .filter((s) => s.income > 0 || s.expense > 0);
  }, [transactions, categories]);

  // Totals for the Category-wise Breakdown (All Time)
  const totalsAllTime = useMemo(() => {
    const income = categoryStats.reduce((sum, s) => sum + s.income, 0);
    const expense = categoryStats.reduce((sum, s) => sum + s.expense, 0);
    return { income, expense };
  }, [categoryStats]);

  // Expense breakdown (Pie) using stats
  const expenseBreakdown = useMemo(
    () =>
      categoryStats
        .filter((s) => s.expense > 0)
        .map((s) => ({ name: s.name, value: s.expense, percentage: s.pctExpense, color: s.color })),
    [categoryStats]
  );

  // Income breakdown (Pie) using stats
  const incomeBreakdown = useMemo(
    () =>
      categoryStats
        .filter((s) => s.income > 0)
        .map((s) => ({ name: s.name, value: s.income, percentage: s.pctIncome, color: s.color })),
    [categoryStats]
  );

  // Category performance for current month — top categories by expense, include income for comparison
  const categoryPerformanceMonthly = useMemo(() => {
    const perCat = categories.map((cat) => {
      const catTxs = currentMonthTransactions.filter((t) => t.categoryId === cat.id);
      const income = catTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = catTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return { name: cat.name, income, expense, color: cat.color };
    });

    // Top 10 by expense
    return perCat
      .filter((c) => c.expense > 0 || c.income > 0)
      .sort((a, b) => b.expense - a.expense)
      .slice(0, 10);
  }, [categories, currentMonthTransactions]);

  const getDailySpendingTrend = () => {
    const dailyData = [];
    const baseline = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(baseline);
      date.setDate(date.getDate() - i);

      const dayTransactions = transactions.filter((t) => {
        const td = new Date(t.date);
        return td.toDateString() === date.toDateString();
      });

      const spending = dayTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

      dailyData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        spending,
      });
    }

    return dailyData;
  };

  const getLoansSummary = () => {
    const totalGiven = loans.filter((l) => l.type === 'given' && l.status === 'pending').reduce((sum, l) => sum + l.amount, 0);
    const totalTaken = loans.filter((l) => l.type === 'taken' && l.status === 'pending').reduce((sum, l) => sum + l.amount, 0);
    const netPosition = totalGiven - totalTaken;
    return { totalGiven, totalTaken, netPosition };
  };

  const getActivitySummary = () => {
    const totalTransactions = transactions.length;
    const monthlyTransactions = currentMonthTransactions.length;

    const avgDailySpending = getDailySpendingTrend().reduce((sum, day) => sum + day.spending, 0) / 30;

    const activeUsers = users.filter((user) => transactions.some((t) => t.userId === user.id)).length;

    return { totalTransactions, monthlyTransactions, avgDailySpending, activeUsers };
  };

  const monthSummary = getCurrentMonthData();
  const loansSummary = getLoansSummary();
  const activitySummary = getActivitySummary();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Financial Reports</h1>

      {/* Current Month Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month's Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(monthSummary.income)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month's Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(monthSummary.expenses)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthSummary.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(monthSummary.netIncome))}
            </div>
            <p className="text-xs text-muted-foreground">{monthSummary.netIncome >= 0 ? 'Surplus' : 'Deficit'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthSummary.savingsRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthSummary.savingsRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Income vs Expenses (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getMonthlyTrend()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="Income" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category-wise Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expenseBreakdown.map((entry, index) => (
                    <Cell key={`exp-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category-wise Income Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={incomeBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {incomeBreakdown.map((entry, index) => (
                    <Cell key={`inc-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Performance (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={categoryPerformanceMonthly}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 8, left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Legend />
                <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" />
                <Bar dataKey="income" fill="#10b981" name="Income" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Spending Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getDailySpendingTrend()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="spending" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net Income Trend (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getMonthlyTrend()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="net" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Loans Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Given:</span>
              <span className="text-green-600 font-bold">{formatCurrency(loansSummary.totalGiven)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Taken:</span>
              <span className="text-red-600 font-bold">{formatCurrency(loansSummary.totalTaken)}</span>
            </div>
            <div className="flex justify-between items-center border-t pt-2">
              <span className="text-sm font-medium">Net Position:</span>
              <span className={`font-bold ${loansSummary.netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(loansSummary.netPosition))}
                <Badge variant="outline" className="ml-2">
                  {loansSummary.netPosition >= 0 ? 'You are owed' : 'You owe'}
                </Badge>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium flex items-center">
                <Activity className="mr-2 h-4 w-4" />
                Total Transactions:
              </span>
              <span className="font-bold">{activitySummary.totalTransactions}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">This Month:</span>
              <span className="font-bold">{activitySummary.monthlyTransactions}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Avg Daily Spending:</span>
              <span className="font-bold">{formatCurrency(activitySummary.avgDailySpending)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium flex items-center">
                <UsersIcon className="mr-2 h-4 w-4" />
                Active Users:
              </span>
              <span className="font-bold">{activitySummary.activeUsers}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Performance (Top 5 by Expense)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryPerformanceMonthly.slice(0, 5).map((cat, index) => (
                <div key={`${cat.name}-${index}`} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Expense</div>
                    <div className="text-sm font-bold">{formatCurrency(cat.expense)}</div>
                    {cat.income > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Income: <span className="font-semibold">{formatCurrency(cat.income)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category-wise Detailed Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Category-wise Breakdown (All Time)</CardTitle>
          <Button onClick={generateCategoryBreakdownPDF} variant="outline" size="sm">
            <FileText className="mr-2 h-4 w-4" />
            Export PDF Report
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Income</th>
                  <th className="py-2 pr-4">Expense</th>
                  <th className="py-2 pr-4">Net</th>
                  <th className="py-2 pr-4">% of Total Income</th>
                  <th className="py-2 pr-4">% of Total Expense</th>
                  <th className="py-2 pr-4">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {categoryStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No category data yet. Add transactions and categories in Settings.
                    </td>
                  </tr>
                ) : (
                  categoryStats
                    .sort((a, b) => b.expense - a.expense)
                    .map((s, idx) => (
                      <tr key={`${s.id}-${idx}`} className="border-b">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-green-600 font-medium">{formatCurrency(s.income)}</td>
                        <td className="py-2 pr-4 text-red-600 font-medium">{formatCurrency(s.expense)}</td>
                        <td className={`py-2 pr-4 font-semibold ${s.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(s.net))} {s.net >= 0 ? '(Surplus)' : '(Deficit)'}
                        </td>
                        <td className="py-2 pr-4">{s.pctIncome.toFixed(1)}%</td>
                        <td className="py-2 pr-4">{s.pctExpense.toFixed(1)}%</td>
                        <td className="py-2 pr-4">{s.count}</td>
                      </tr>
                    ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td className="py-2 pr-4 font-semibold">Total</td>
                  <td className="py-2 pr-4 text-green-700 font-semibold">{formatCurrency(totalsAllTime.income)}</td>
                  <td className="py-2 pr-4 text-red-700 font-semibold">{formatCurrency(totalsAllTime.expense)}</td>
                  <td className="py-2 pr-4"></td>
                  <td className="py-2 pr-4"></td>
                  <td className="py-2 pr-4"></td>
                  <td className="py-2 pr-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}