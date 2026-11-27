import { useState, useEffect, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import AppNavbar from '@/components/AppNavbar';
import TransactionManager from '@/components/TransactionManager';
import ReportsPage from '@/components/ReportsPage';
import LoansManager from '@/components/LoansManager';
import GoalsManager from '@/components/GoalsManager';
import SettingsPage from '@/components/SettingsPage';
import UsersTab from '@/components/UsersTab';
import AdditionalInfoTab from '@/components/AdditionalInfoTab';
import { AccountAvatar, Avatar, ControlPanel, Delta, PageBody, Scorecard, Sheet, Tag, TX_LABEL, TX_TONE } from '@/components/erp';
import { getUsers, getCategories, getAccounts, formatCurrency } from '@/lib/storage';
import { apiClient } from '@/lib/api';
import { isAdmin } from '@/lib/auth';
import { formatDateDhaka } from '@/lib/dhakaTime';
import { type DayRange, addMonths, dayKeyOf, formatDayRange, inRange, previousPeriod, startOfMonth, todayKey } from '@/lib/dateRange';
import { useChartColors } from '@/lib/chartColors';
import { Transaction, User, Category, Loan, Goal, Account } from '@/components/types';
import { summarize, loanSummary, txMeta, cashSign } from '@/lib/finance';

export default function Index() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [txIntent, setTxIntent] = useState<{ key: number; accountId?: string; openNew?: boolean }>({ key: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const isAdminUser = isAdmin();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [txnsRaw, usrs, cats, accs, lnsRaw, glsRaw] = await Promise.all([
      apiClient.getTransactions(),
      getUsers(),
      getCategories(),
      getAccounts(),
      apiClient.getLoans(),
      apiClient.getGoals(),
    ]);

    // Map transactions: server snake_case → frontend camelCase (with fallback for old local storage data)
    const txns = (txnsRaw as Record<string, unknown>[]).map(t => ({
      id:            String(t.id ?? ''),
      voucherId:     String(t.voucher_id ?? t.voucherId ?? ''),
      title:         String(t.title ?? ''),
      description:   t.description ? String(t.description) : undefined,
      amount:        Number(t.amount ?? 0),
      type:          t.type as Transaction['type'],
      categoryId:    String(t.category_id ?? t.categoryId ?? ''),
      categoryName:  t.category_name ? String(t.category_name) : (t.categoryName ? String(t.categoryName) : undefined),
      categoryColor: t.category_color ? String(t.category_color) : (t.categoryColor ? String(t.categoryColor) : undefined),
      accountId:     t.account_id ? String(t.account_id) : undefined,
      accountName:   t.account_name ? String(t.account_name) : undefined,
      accountType:   t.account_type ? String(t.account_type) : undefined,
      toAccountId:   t.to_account_id ? String(t.to_account_id) : (t.toAccountId ? String(t.toAccountId) : undefined),
      toAccountName: t.to_account_name ? String(t.to_account_name) : (t.toAccountName ? String(t.toAccountName) : undefined),
      loanId:        t.loan_id ? String(t.loan_id) : (t.loanId ? String(t.loanId) : undefined),
      userId:        String(t.financial_user_id ?? t.userId ?? ''),
      userName:      t.user_name ? String(t.user_name) : (t.userName ? String(t.userName) : undefined),
      date:          String(t.date ?? ''),
      createdAt:     String(t.created_at ?? t.createdAt ?? ''),
      updatedAt:     String(t.updated_at ?? t.updatedAt ?? ''),
    }));

    // Map goals: server snake_case → frontend camelCase
    const gls = (glsRaw as Record<string, unknown>[]).map(g => ({
      id:            String(g.id ?? ''),
      title:         String(g.name ?? g.title ?? ''),
      description:   g.description ? String(g.description) : undefined,
      targetAmount:  Number(g.target_amount ?? g.targetAmount ?? 0),
      currentAmount: Number(g.current_amount ?? g.currentAmount ?? 0),
      deadline:      String(g.deadline ?? ''),
      priority:      (g.priority as Goal['priority']) || 'medium',
      status:        (g.status as Goal['status']) || 'active',
      createdAt:     String(g.created_at ?? g.createdAt ?? ''),
      updatedAt:     String(g.updated_at ?? g.updatedAt ?? ''),
    }));

    // Map loans: server snake_case → frontend camelCase
    const lns = (lnsRaw as Record<string, unknown>[]).map(l => ({
      id:             String(l.id ?? ''),
      transactionId:  String(l.transaction_id ?? l.transactionId ?? ''),
      userId:         String(l.user_id ?? l.userId ?? ''),
      person:         l.person ? String(l.person) : undefined,
      amount:         Number(l.amount ?? 0),
      type:           l.type as Loan['type'],
      status:         String(l.status ?? 'pending') as Loan['status'],
      repaidAmount:   Number(l.repaid_amount ?? l.repaidAmount ?? 0),
      repaid_amount:  Number(l.repaid_amount ?? l.repaidAmount ?? 0),
      forgivenAmount: Number(l.forgiven_amount ?? l.forgivenAmount ?? 0),
      dueDate:        l.due_date ? String(l.due_date) : (l.dueDate ? String(l.dueDate) : undefined),
      createdAt:      String(l.created_at ?? l.createdAt ?? ''),
    }));

    setTransactions(txns as Transaction[]);
    setUsers(usrs as User[]);
    setCategories(cats as Category[]);
    setAccounts(accs as Account[]);
    setLoans(lns as unknown as Loan[]);
    setGoals(gls as Goal[]);
  };

  // ── Figures ───────────────────────────────────────────────────────────────
  const colors = useChartColors();
  const today = todayKey();
  const monthStart = startOfMonth(today);
  const monthRange: DayRange = { start: monthStart, end: today };
  const prevMonthRange = previousPeriod(monthRange);

  const rows = useMemo(() => transactions.map(t => ({ ...t, day: dayKeyOf(t.date) })).filter(t => t.day), [transactions]);
  const thisMonth = summarize(rows.filter(t => inRange(t.day, monthRange)));
  const lastMonth = summarize(rows.filter(t => inRange(t.day, prevMonthRange)));

  const totalAccountFunds = accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);
  const balance = accounts.length > 0 ? totalAccountFunds : summarize(transactions).netCashFlow;

  const loanStats = loanSummary(loans as unknown as Parameters<typeof loanSummary>[0]);
  const pendingLoansCount = loanStats.openGiven + loanStats.openTaken;
  const activeGoals = goals.filter(g => g.status === 'active');

  // Last 12 months, oldest first
  const months = useMemo(() => {
    const list: { key: string; label: string; income: number; expense: number; net: number; cash: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const key = addMonths(monthStart, -i).slice(0, 7);
      list.push({ key, label: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short' }).format(new Date(`${key}-01T00:00:00Z`)), income: 0, expense: 0, net: 0, cash: 0 });
    }
    const byKey = new Map(list.map(m => [m.key, m]));
    const opening = accounts.reduce((s, a) => s + (a.initialBalance ?? 0), 0);
    let before = 0;
    for (const t of rows) {
      const m = byKey.get(t.day.slice(0, 7));
      if (m) {
        if (t.type === 'income') m.income += t.amount;
        if (t.type === 'expense') m.expense += t.amount;
        m.cash += cashSign(t.type) * t.amount;
      } else if (t.day < list[0].key) {
        before += cashSign(t.type) * t.amount;
      }
    }
    let running = opening + before;
    for (const m of list) {
      m.net = m.income - m.expense;
      running += m.cash;
      m.cash = running;
    }
    return list;
  }, [rows, accounts, monthStart]);

  // Money in and out of each account this month (transfers count on both sides)
  const accountActivity = useMemo(() => {
    const map = new Map<string, { inMonth: number; outMonth: number }>();
    const add = (id: string | undefined, signed: number, day: string) => {
      if (!id || signed === 0 || day < monthStart || day > today) return;
      const e = map.get(id) ?? { inMonth: 0, outMonth: 0 };
      if (signed > 0) e.inMonth += signed; else e.outMonth -= signed;
      map.set(id, e);
    };
    for (const t of rows) {
      if (t.type === 'transfer') {
        add(t.accountId, -t.amount, t.day);
        add(t.toAccountId, t.amount, t.day);
      } else {
        add(t.accountId, cashSign(t.type) * t.amount, t.day);
      }
    }
    return map;
  }, [rows, monthStart, today]);

  const topExpenses = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const t of rows) {
      if (t.type !== 'expense' || !inRange(t.day, monthRange)) continue;
      const name = categories.find(c => c.id === t.categoryId)?.name || t.categoryName || 'Uncategorized';
      byCat.set(name, (byCat.get(name) ?? 0) + t.amount);
    }
    return [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, categories, monthStart, today]);

  const recent = [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

  const userName = (t: Transaction) =>
    users.find(u => u.id === t.userId)?.name
    || users.find(u => t.userName && u.name.toLowerCase() === t.userName.toLowerCase())?.name
    || t.userName || 'Unknown';
  const categoryName = (t: Transaction) =>
    categories.find(c => c.id === t.categoryId)?.name
    || categories.find(c => t.categoryName && c.name.toLowerCase() === t.categoryName.toLowerCase())?.name
    || t.categoryName || 'Uncategorized';

  const accountTypeLabel = (type: string) => ({
    cash: 'Cash', bank: 'Bank', mobile_wallet: 'Mobile wallet', mobile_banking: 'Mobile banking',
    credit_card: 'Credit card', savings: 'Savings', other: 'Other',
  } as Record<string, string>)[type] ?? type;

  const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
  const pctText = (n: number) => `${Math.abs(n).toFixed(1)}%`;
  const vsLabel = 'vs same days last month';

  const openTransactions = (intent: { accountId?: string; openNew?: boolean }) => {
    setTxIntent({ ...intent, key: Date.now() });
    setActiveTab('transactions');
  };

  return (
    <div className="flex h-screen flex-col bg-page">
      <AppNavbar
        activeTab={activeTab}
        onTabChange={tab => { if (tab === 'transactions') setTxIntent({ key: Date.now() }); setActiveTab(tab); }}
        pendingLoansCount={pendingLoansCount}
        activeGoalsCount={activeGoals.length}
      />

      <main className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="dashboard" className="mt-0">
            <ControlPanel
              title="Dashboard"
              actions={
                <Button size="sm" onClick={() => openTransactions({ openNew: true })}>
                  <Plus className="h-4 w-4" aria-hidden />
                  New transaction
                </Button>
              }
            >
              <Button variant="secondary" size="sm" onClick={() => setActiveTab('settings')}>
                <ArrowLeftRight className="h-4 w-4" aria-hidden />
                Transfer funds
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab('reports')}>
                Reports
              </Button>
            </ControlPanel>

            <PageBody>
              {/* Scorecards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Scorecard
                  label="Cash and bank"
                  value={formatCurrency(balance)}
                  emphasis
                  trend={months.map(m => m.cash)}
                  color={colors.balance}
                  delta={loanStats.netPosition !== 0
                    ? <p className="text-xs text-muted-foreground">Net worth with loans <span className="font-medium text-foreground">{formatCurrency(balance + loanStats.netPosition)}</span></p>
                    : null}
                />
                <Scorecard
                  label="Income this month"
                  value={formatCurrency(thisMonth.income)}
                  trend={months.map(m => m.income)}
                  color={colors.income}
                  delta={<Delta value={pct(thisMonth.income, lastMonth.income)} format={pctText} label={vsLabel} />}
                />
                <Scorecard
                  label="Expenses this month"
                  value={formatCurrency(thisMonth.expense)}
                  trend={months.map(m => m.expense)}
                  color={colors.expense}
                  delta={<Delta value={pct(thisMonth.expense, lastMonth.expense)} format={pctText} label={vsLabel} upIsGood={false} />}
                />
                <Scorecard
                  label={thisMonth.netSavings >= 0 ? 'Saved this month' : 'Overspent this month'}
                  value={formatCurrency(Math.abs(thisMonth.netSavings))}
                  trend={months.map(m => m.net)}
                  color={thisMonth.netSavings >= 0 ? colors.balance : colors.negative}
                  delta={<p className="text-xs text-muted-foreground">
                    Savings rate {thisMonth.income > 0 ? `${((thisMonth.netSavings / thisMonth.income) * 100).toFixed(1)}%` : '—'}
                  </p>}
                />
              </div>

              {/* Account cards */}
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold">Accounts</h2>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setActiveTab('settings')}>Manage accounts</Button>
                </div>
                {accounts.length === 0 ? (
                  <Sheet>
                    <div className="p-6 text-sm text-muted-foreground">
                      No accounts yet.{' '}
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setActiveTab('settings')}>Add one in Settings</Button>
                    </div>
                  </Sheet>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
                    {accounts.map(account => {
                      const activity = accountActivity.get(account.id);
                      const balanceValue = account.balance ?? 0;
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => openTransactions({ accountId: account.id })}
                          aria-label={`${account.name}, balance ${formatCurrency(balanceValue)}. View its transactions`}
                          className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
                        >
                          <div className="flex w-full items-center gap-3">
                            <AccountAvatar name={account.name} bankName={account.bankName} color={account.color} size="lg" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{account.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {accountTypeLabel(account.type)}{account.accountNumber ? `, #${account.accountNumber}` : ''}
                              </p>
                            </div>
                          </div>
                          <p className={`text-2xl font-semibold tabular-nums ${balanceValue < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {formatCurrency(balanceValue)}
                          </p>
                          <dl className="grid w-full grid-cols-2 gap-2 border-t pt-2 text-xs">
                            <div>
                              <dt className="text-muted-foreground">In this month</dt>
                              <dd className="mt-0.5 font-medium tabular-nums">{formatCurrency(activity?.inMonth ?? 0)}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Out this month</dt>
                              <dd className="mt-0.5 font-medium tabular-nums">{formatCurrency(activity?.outMonth ?? 0)}</dd>
                            </div>
                          </dl>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Trend + top expenses */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Sheet
                  className="xl:col-span-2"
                  title="Income and expenses"
                  note="Last 6 months"
                  actions={
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors.income }} />Income</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors.expense }} />Expenses</span>
                    </div>
                  }
                >
                  <div className="h-64 px-2 py-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={months.slice(-6)} barGap={2} barCategoryGap="30%" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} stroke={colors.grid} />
                        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: colors.axis }} tick={{ fill: colors.tick, fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: colors.tick, fontSize: 12 }} tickFormatter={v => compact.format(Number(v))} width={44} />
                        <RechartsTooltip
                          cursor={{ fill: colors.cursor }}
                          formatter={(v: number, name: string) => [formatCurrency(Number(v)), name]}
                          contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12, color: 'hsl(var(--popover-foreground))' }}
                        />
                        <Bar dataKey="income" name="Income" fill={colors.income} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                        <Bar dataKey="expense" name="Expenses" fill={colors.expense} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Sheet>

                <Sheet title="Top expenses" note="This month">
                  {topExpenses.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No expenses this month.</p>
                  ) : (
                    <ul className="space-y-3 p-4">
                      {topExpenses.map(([name, amount]) => (
                        <li key={name} className="text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="truncate">{name}</span>
                            <span className="tabular-nums">{formatCurrency(amount)}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted">
                            <div className="h-1.5 rounded-full" style={{ width: `${(amount / topExpenses[0][1]) * 100}%`, backgroundColor: colors.expense }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Sheet>
              </div>

              {/* Activity, loans, goals */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Sheet
                  className="xl:col-span-2"
                  title="Recent activity"
                  actions={<Button variant="link" size="sm" className="h-auto p-0" onClick={() => openTransactions({})}>All transactions</Button>}
                >
                  {recent.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      No transactions yet.{' '}
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => openTransactions({ openNew: true })}>Add a transaction</Button>
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {recent.map(t => {
                        const meta = txMeta(t.type);
                        const who = userName(t);
                        return (
                          <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                            <Avatar name={who} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{t.title}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <Tag tone={TX_TONE[t.type]}>{TX_LABEL[t.type] ?? t.type}</Tag>
                                <span>{t.type === 'transfer' ? `${t.accountName || 'Account'} → ${t.toAccountName || 'Account'}` : categoryName(t)}</span>
                                <span>{who}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-semibold tabular-nums ${meta.text}`}>{meta.prefix}{formatCurrency(t.amount)}</p>
                              <p className="text-xs tabular-nums text-muted-foreground">{formatDateDhaka(t.date)}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Sheet>

                <div className="space-y-4">
                  <Sheet title="Loans" actions={<Button variant="link" size="sm" className="h-auto p-0" onClick={() => setActiveTab('loans')}>Open loans</Button>}>
                    <div className="grid grid-cols-2 divide-x border-b">
                      <div className="p-4">
                        <p className="text-xs text-muted-foreground">Owed to you</p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatCurrency(loanStats.outstandingGiven)}</p>
                        <p className="text-xs text-muted-foreground">{loanStats.openGiven} open</p>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-muted-foreground">You owe</p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatCurrency(loanStats.outstandingTaken)}</p>
                        <p className="text-xs text-muted-foreground">{loanStats.openTaken} open</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-muted-foreground">Net position</span>
                      <span className={`font-semibold tabular-nums ${loanStats.netPosition < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                        {loanStats.netPosition < 0 ? '-' : ''}{formatCurrency(Math.abs(loanStats.netPosition))}
                      </span>
                    </div>
                  </Sheet>

                  <Sheet title="Savings goals" actions={<Button variant="link" size="sm" className="h-auto p-0" onClick={() => setActiveTab('goals')}>Open goals</Button>}>
                    {activeGoals.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">No active goals.</p>
                    ) : (
                      <ul className="space-y-4 p-4">
                        {activeGoals.slice(0, 4).map(goal => {
                          const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                          return (
                            <li key={goal.id}>
                              <div className="flex items-baseline justify-between gap-2 text-sm">
                                <span className="truncate font-medium">{goal.title}</span>
                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{progress.toFixed(0)}%</span>
                              </div>
                              <Progress value={Math.min(progress, 100)} className="mt-1.5 h-1.5" />
                              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                                {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Sheet>
                </div>
              </div>

              {isAdminUser && (
                <Sheet title="Records">
                  <dl className="grid grid-cols-2 divide-x divide-y sm:grid-cols-5 sm:divide-y-0">
                    {[
                      ['Financial users', users.length],
                      ['Transactions', transactions.length],
                      ['Savings goals', goals.length],
                      ['Categories', categories.length],
                      ['Accounts', accounts.length],
                    ].map(([label, value]) => (
                      <div key={label as string} className="px-4 py-3">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Sheet>
              )}
            </PageBody>
          </TabsContent>

          <TabsContent value="transactions" className="mt-0">
            <TransactionManager
              key={txIntent.key}
              onDataChange={loadData}
              initialAccountId={txIntent.accountId}
              openNewOnMount={txIntent.openNew}
            />
          </TabsContent>

          <TabsContent value="goals" className="mt-0">
            <GoalsManager onDataChange={loadData} />
          </TabsContent>

          <TabsContent value="reports" className="mt-0">
            <ReportsPage />
          </TabsContent>

          <TabsContent value="loans" className="mt-0">
            <LoansManager onDataChange={loadData} />
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <UsersTab onDataChange={loadData} />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <SettingsPage onDataChange={loadData} />
          </TabsContent>

          <TabsContent value="additional" className="mt-0">
            <AdditionalInfoTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
