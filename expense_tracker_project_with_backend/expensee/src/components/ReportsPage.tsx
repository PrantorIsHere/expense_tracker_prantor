import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { ArrowDown, ArrowUp, ChevronDown, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DateRangePicker from '@/components/DateRangePicker';
import { AccountAvatar, ControlPanel, PageBody } from '@/components/erp';
import { getAccounts, getCategories, getUsers, formatCurrency } from '@/lib/storage';
import { apiClient } from '@/lib/api';
import { Account, Category, Goal, Loan, Transaction, User } from '@/components/types';
import { generateCategoryBreakdownPDF } from '@/lib/categoryBreakdownPDF';
import { downloadStatementPDF } from '@/lib/monthlyStatementPDF';
import { createStatementPeriod } from '@/lib/statementPeriod';
import { loanRemaining, summarize } from '@/lib/finance';
import { CHART, useChartColors } from '@/lib/chartColors';
import {
  RANGE_PRESETS,
  type DayRange,
  addDays,
  addMonths,
  dayCount,
  dayKeyOf,
  formatDayKey,
  formatDayRange,
  inRange,
  matchPreset,
  previousPeriod,
  startOfMonth,
  todayKey,
} from '@/lib/dateRange';

type Row = Transaction & { day: string };
type Granularity = 'day' | 'month' | 'year';

const REPORT_PRESETS = ['thisMonth', 'lastMonth', 'last30', 'thisQuarter', 'thisYear', 'lastYear', 'last12'];

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const monthLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short', year: '2-digit' });
const dayLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const keyDate = (key: string) => new Date(`${key}T00:00:00Z`);

const signedCurrency = (n: number) => `${n < 0 ? '-' : ''}${formatCurrency(Math.abs(n))}`;

function bucketOf(day: string, granularity: Granularity) {
  return granularity === 'day' ? day : granularity === 'month' ? day.slice(0, 7) : day.slice(0, 4);
}

function bucketsFor(range: DayRange, granularity: Granularity) {
  const keys: { key: string; label: string; long: string }[] = [];
  if (granularity === 'day') {
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
      keys.push({ key: d, label: dayLabel.format(keyDate(d)), long: formatDayKey(d) });
    }
  } else if (granularity === 'month') {
    for (let d = startOfMonth(range.start); d <= range.end; d = addMonths(d, 1)) {
      const date = keyDate(d);
      keys.push({
        key: d.slice(0, 7),
        label: monthLabel.format(date),
        long: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(date),
      });
    }
  } else {
    for (let y = Number(range.start.slice(0, 4)); y <= Number(range.end.slice(0, 4)); y++) {
      keys.push({ key: String(y), label: String(y), long: String(y) });
    }
  }
  return keys;
}

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [range, setRange] = useState<DayRange | null>(() => RANGE_PRESETS.find(p => p.id === 'thisYear')!.range());
  const [accountId, setAccountId] = useState('all');
  const [userId, setUserId] = useState('all');
  const [trendView, setTrendView] = useState<'graph' | 'table'>('graph');
  const [sort, setSort] = useState<{ key: 'name' | 'count' | 'income' | 'expense' | 'net'; desc: boolean }>({ key: 'expense', desc: true });

  const colors = useChartColors();

  useEffect(() => {
    (async () => {
      const [txnsRaw, cats, usrs, lnsRaw, glsRaw, accs] = await Promise.all([
        apiClient.getTransactions(),
        getCategories(),
        getUsers(),
        apiClient.getLoans(),
        apiClient.getGoals(),
        getAccounts(),
      ]);

      const txns = (txnsRaw as Record<string, unknown>[]).map(t => ({
        id: String(t.id ?? ''),
        voucherId: String(t.voucher_id ?? t.voucherId ?? ''),
        title: String(t.title ?? ''),
        description: t.description ? String(t.description) : undefined,
        amount: Number(t.amount ?? 0),
        type: t.type as Transaction['type'],
        categoryId: String(t.category_id ?? t.categoryId ?? ''),
        categoryName: t.category_name ? String(t.category_name) : (t.categoryName ? String(t.categoryName) : undefined),
        categoryColor: t.category_color ? String(t.category_color) : (t.categoryColor ? String(t.categoryColor) : undefined),
        accountId: t.account_id || t.accountId ? String(t.account_id ?? t.accountId) : undefined,
        accountName: t.account_name ? String(t.account_name) : undefined,
        toAccountId: t.to_account_id || t.toAccountId ? String(t.to_account_id ?? t.toAccountId) : undefined,
        userId: String(t.financial_user_id ?? t.userId ?? ''),
        userName: t.user_name ? String(t.user_name) : (t.userName ? String(t.userName) : undefined),
        date: String(t.date ?? ''),
        createdAt: String(t.created_at ?? t.createdAt ?? ''),
        updatedAt: String(t.updated_at ?? t.updatedAt ?? ''),
      }));

      const lns = (lnsRaw as Record<string, unknown>[]).map(l => ({
        id: String(l.id ?? ''),
        person: l.person ? String(l.person) : undefined,
        amount: Number(l.amount ?? 0),
        type: l.type as Loan['type'],
        status: String(l.status ?? 'pending') as Loan['status'],
        repaidAmount: Number(l.repaid_amount ?? l.repaidAmount ?? 0),
        repaid_amount: Number(l.repaid_amount ?? l.repaidAmount ?? 0),
        dueDate: l.due_date ? String(l.due_date) : (l.dueDate ? String(l.dueDate) : undefined),
      }));

      const gls = (glsRaw as Record<string, unknown>[]).map(g => ({
        id: String(g.id ?? ''),
        title: String(g.name ?? g.title ?? ''),
        targetAmount: Number(g.target_amount ?? g.targetAmount ?? 0),
        currentAmount: Number(g.current_amount ?? g.currentAmount ?? 0),
        deadline: String(g.deadline ?? ''),
        priority: (g.priority as Goal['priority']) || 'medium',
        status: (g.status as Goal['status']) || 'active',
        createdAt: String(g.created_at ?? g.createdAt ?? ''),
        updatedAt: String(g.updated_at ?? g.updatedAt ?? ''),
      }));

      setTransactions(txns as Transaction[]);
      setCategories(cats as Category[]);
      setUsers(usrs as User[]);
      setLoans(lns as Loan[]);
      setGoals(gls as Goal[]);
      setAccounts(accs as Account[]);
    })();
  }, []);

  const today = todayKey();

  // Account and user filters apply to every figure; the period applies to everything time-based.
  const scoped = useMemo<Row[]>(() => transactions
    .map(t => ({ ...t, day: dayKeyOf(t.date) }))
    .filter(t => t.day)
    .filter(t => accountId === 'all' || t.accountId === accountId || t.toAccountId === accountId)
    .filter(t => userId === 'all' || t.userId === userId), [transactions, accountId, userId]);

  const effectiveRange = useMemo<DayRange>(() => {
    if (range) return range;
    const first = scoped.reduce((min, t) => (t.day < min ? t.day : min), today);
    return { start: first, end: today };
  }, [range, scoped, today]);

  const current = useMemo(() => scoped.filter(t => inRange(t.day, range)), [scoped, range]);
  const comparison = range ? previousPeriod(range) : null;
  const previous = useMemo(
    () => (comparison ? scoped.filter(t => inRange(t.day, comparison)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, comparison?.start, comparison?.end],
  );

  const cur = summarize(current);
  const prev = previous ? summarize(previous) : null;
  const savingsRate = cur.income > 0 ? (cur.netSavings / cur.income) * 100 : null;
  const prevSavingsRate = prev && prev.income > 0 ? (prev.netSavings / prev.income) * 100 : null;
  const elapsedDays = dayCount({ start: effectiveRange.start, end: effectiveRange.end > today ? today : effectiveRange.end });
  const avgDailyExpense = elapsedDays > 0 ? cur.expense / elapsedDays : 0;
  const prevAvgDailyExpense = prev && comparison ? prev.expense / dayCount(comparison) : null;

  const periodLabel = range ? (matchPreset(range) ? `${matchPreset(range)!.label}, ${formatDayRange(range)}` : formatDayRange(range)) : 'All time';

  // Trend buckets
  const days = dayCount(effectiveRange);
  const granularity: Granularity = days <= 62 ? 'day' : days <= 1100 ? 'month' : 'year';
  const trend = useMemo(() => {
    const totals = new Map<string, { income: number; expense: number }>();
    for (const t of current) {
      if (t.type !== 'income' && t.type !== 'expense') continue;
      const key = bucketOf(t.day, granularity);
      const entry = totals.get(key) ?? { income: 0, expense: 0 };
      entry[t.type] += t.amount;
      totals.set(key, entry);
    }
    return bucketsFor(effectiveRange, granularity).map(b => {
      const v = totals.get(b.key) ?? { income: 0, expense: 0 };
      return { ...b, income: v.income, expense: v.expense, net: v.income - v.expense };
    });
  }, [current, effectiveRange, granularity]);

  // Category analysis (income and expense transactions only; loans are in Cash flow)
  const categoryRows = useMemo(() => {
    const byKey = new Map<string, { id: string; name: string; color: string; income: number; expense: number; count: number }>();
    const findCategory = (t: Row) => categories.find(c => c.id === t.categoryId)
      || categories.find(c => t.categoryName && c.name.toLowerCase() === t.categoryName.toLowerCase());
    for (const t of current) {
      if (t.type !== 'income' && t.type !== 'expense') continue;
      const cat = findCategory(t);
      const id = cat?.id ?? 'uncategorized';
      const entry = byKey.get(id) ?? {
        id, name: cat?.name ?? (t.categoryName || 'Uncategorized'), color: cat?.color ?? t.categoryColor ?? '#9ca3af',
        income: 0, expense: 0, count: 0,
      };
      entry[t.type] += t.amount;
      entry.count += 1;
      byKey.set(id, entry);
    }
    return [...byKey.values()].map(r => ({ ...r, net: r.income - r.expense }));
  }, [current, categories]);

  const sortedCategories = useMemo(() => [...categoryRows].sort((a, b) => {
    const dir = sort.desc ? -1 : 1;
    if (sort.key === 'name') return a.name.localeCompare(b.name) * dir;
    return (a[sort.key] - b[sort.key]) * dir;
  }), [categoryRows, sort]);

  const expenseRanking = useMemo(() => {
    const ranked = categoryRows.filter(r => r.expense > 0).sort((a, b) => b.expense - a.expense);
    const top = ranked.slice(0, 7);
    const rest = ranked.slice(7);
    if (rest.length) top.push({ id: 'other', name: rest.length === 1 ? rest[0].name : `${rest.length} other categories`, color: '', income: 0, count: 0, net: 0, expense: rest.reduce((s, r) => s + r.expense, 0) });
    return top;
  }, [categoryRows]);

  const userRows = useMemo(() => {
    const byUser = new Map<string, { name: string; income: number; expense: number }>();
    for (const t of current) {
      if (t.type !== 'income' && t.type !== 'expense') continue;
      const name = users.find(u => u.id === t.userId)?.name || t.userName || 'Unassigned';
      const entry = byUser.get(name) ?? { name, income: 0, expense: 0 };
      entry[t.type] += t.amount;
      byUser.set(name, entry);
    }
    return [...byUser.values()].sort((a, b) => b.expense - a.expense);
  }, [current, users]);

  // Goals pace uses the last 30 days of savings
  const dailySavings = useMemo(() => {
    const since = addDays(today, -29);
    const recent = summarize(scoped.filter(t => t.day >= since && t.day <= today));
    return recent.netSavings / 30;
  }, [scoped, today]);

  const openLoans = loans.map(l => ({ ...l, remaining: loanRemaining(l) })).filter(l => l.remaining > 0).sort((a, b) => b.remaining - a.remaining);
  const activeGoals = goals.filter(g => g.status === 'active');
  const totalBalance = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const filtersActive = accountId !== 'all' || userId !== 'all';

  const exportStatement = () => {
    const period = createStatementPeriod(effectiveRange.start, effectiveRange.end);
    downloadStatementPDF(current, users, categories, period);
  };

  const toggleSort = (key: typeof sort.key) =>
    setSort(s => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' }));

  const maxExpense = expenseRanking[0]?.expense ?? 0;
  const totalExpense = categoryRows.reduce((s, r) => s + r.expense, 0);
  const totalIncome = categoryRows.reduce((s, r) => s + r.income, 0);

  return (
    <>
      <ControlPanel title="Reports">
        <DateRangePicker
          value={range}
          onChange={setRange}
          clearLabel="All time"
          presets={REPORT_PRESETS}
          className="h-8 w-full text-[13px] sm:w-auto sm:min-w-64"
        />
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="h-8 w-full text-[13px] sm:w-44" aria-label="Account">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="h-8 w-full text-[13px] sm:w-44" aria-label="User">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => { setAccountId('all'); setUserId('all'); }}>
            <X className="mr-1 h-4 w-4" aria-hidden />
            Clear filters
          </Button>
        )}
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Download className="h-4 w-4" aria-hidden />
                Export
                <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={current.length === 0} onSelect={exportStatement}>Statement (PDF)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => generateCategoryBreakdownPDF(current, categories, periodLabel)}>
                Category breakdown (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ControlPanel>

      <PageBody>
      {/* Key figures */}
      <section className="overflow-hidden rounded-lg border bg-card" aria-label="Key figures">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5 text-sm">
          <span className="font-medium">{periodLabel}</span>
          {comparison && <span className="text-muted-foreground">Compared with {formatDayRange(comparison)}</span>}
        </div>
        <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-3 xl:grid-cols-6">
          <div className="col-span-2 bg-card p-4">
            <p className="text-sm text-muted-foreground">Net result</p>
            <p className={`mt-1 text-4xl font-semibold ${cur.netSavings < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
              {signedCurrency(cur.netSavings)}
            </p>
            {prev && <Delta value={cur.netSavings - prev.netSavings} format={n => `${n > 0 ? '+' : n < 0 ? '-' : ''}${formatCurrency(Math.abs(n))}`} upIsGood />}
          </div>
          <Kpi label="Income" value={formatCurrency(cur.income)}>
            {prev && <PercentDelta current={cur.income} previous={prev.income} upIsGood />}
          </Kpi>
          <Kpi label="Expenses" value={formatCurrency(cur.expense)}>
            {prev && <PercentDelta current={cur.expense} previous={prev.expense} upIsGood={false} />}
          </Kpi>
          <Kpi label="Savings rate" value={savingsRate === null ? '—' : `${savingsRate.toFixed(1)}%`}>
            {prev && savingsRate !== null && prevSavingsRate !== null && (
              <Delta value={savingsRate - prevSavingsRate} format={n => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(1)} pts`} upIsGood />
            )}
          </Kpi>
          <Kpi label="Average daily expense" value={formatCurrency(avgDailyExpense)}>
            {prevAvgDailyExpense !== null && <PercentDelta current={avgDailyExpense} previous={prevAvgDailyExpense} upIsGood={false} />}
          </Kpi>
        </div>
      </section>

      {/* Trend + expense ranking */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Income and expenses"
          actions={
            <div className="flex items-center gap-4">
              {trendView === 'graph' && (
                <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                  <LegendKey color={colors.income} label="Income" />
                  <LegendKey color={colors.expense} label="Expenses" />
                </div>
              )}
              <ViewSwitch value={trendView} onChange={setTrendView} />
            </div>
          }
        >
          {trendView === 'graph' ? (
            <div className="h-full min-h-72 px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} barGap={2} barCategoryGap="25%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={colors.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: colors.axis }} tick={{ fill: colors.tick, fontSize: 12 }} minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: colors.tick, fontSize: 12 }} tickFormatter={v => compact.format(Number(v))} width={48} />
                  <RechartsTooltip cursor={{ fill: colors.cursor }} content={<TrendTooltip colors={colors} />} />
                  <Bar dataKey="income" name="Income" fill={colors.income} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                  <Bar dataKey="expense" name="Expenses" fill={colors.expense} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="max-h-80 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="pl-4">{granularity === 'day' ? 'Day' : granularity === 'month' ? 'Month' : 'Year'}</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="pr-4 text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trend.map(b => (
                    <TableRow key={b.key}>
                      <TableCell className="pl-4">{b.long}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(b.income)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(b.expense)}</TableCell>
                      <TableCell className={`pr-4 text-right tabular-nums ${b.net < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{signedCurrency(b.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-4">Total</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(cur.income)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(cur.expense)}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{signedCurrency(cur.netSavings)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </Panel>

        <Panel title="Expenses by category">
          {expenseRanking.length === 0 ? (
            <Empty>No expenses in this period.</Empty>
          ) : (
            <ul className="space-y-3 px-4 pb-4">
              {expenseRanking.map(r => (
                <li key={r.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatCurrency(r.expense)}
                      <span className="ml-2 inline-block w-12 text-right text-muted-foreground">
                        {totalExpense > 0 ? `${((r.expense / totalExpense) * 100).toFixed(1)}%` : '—'}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${maxExpense > 0 ? Math.max(2, (r.expense / maxExpense) * 100) : 0}%`, backgroundColor: colors.expense }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Net result + cash flow */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Net result">
          <div className="h-56 px-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barCategoryGap="25%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: colors.tick, fontSize: 12 }} minTickGap={16} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: colors.tick, fontSize: 12 }} tickFormatter={v => compact.format(Number(v))} width={48} />
                <ReferenceLine y={0} stroke={colors.axis} />
                <RechartsTooltip cursor={{ fill: colors.cursor }} content={<NetTooltip />} />
                <Bar
                  dataKey="net"
                  name="Net result"
                  isAnimationActive={false}
                  maxBarSize={24}
                  shape={(props: unknown) => <DataEndBar {...(props as DataEndBarProps)} positive={colors.income} negative={colors.negative} />}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Cash flow">
          <Table>
            <TableBody>
              <FlowRow label="Income" value={cur.income} />
              <FlowRow label="Expenses" value={-cur.expense} />
              {(cur.loanTaken > 0 || prev?.loanTaken) ? <FlowRow label="Borrowed" value={cur.loanTaken} /> : null}
              {(cur.loanReceived > 0 || prev?.loanReceived) ? <FlowRow label="Repayments received" value={cur.loanReceived} /> : null}
              {(cur.loanGiven > 0 || prev?.loanGiven) ? <FlowRow label="Lent" value={-cur.loanGiven} /> : null}
              {(cur.loanRepaid > 0 || prev?.loanRepaid) ? <FlowRow label="Repayments made" value={-cur.loanRepaid} /> : null}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4">Net cash flow</TableCell>
                <TableCell className={`pr-4 text-right tabular-nums ${cur.netCashFlow < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {signedCurrency(cur.netCashFlow)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <p className="px-4 py-3 text-xs text-muted-foreground">Transfers between your own accounts are left out.</p>
        </Panel>
      </div>

      {/* Category analysis */}
      <Panel
        title="Category analysis"
        actions={
          <Button variant="ghost" size="sm" className="-mr-2 h-8" onClick={() => generateCategoryBreakdownPDF(current, categories, periodLabel)}>
            <Download className="mr-2 h-4 w-4" aria-hidden />
            PDF
          </Button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Category" sortKey="name" sort={sort} onSort={toggleSort} className="pl-4" />
              <SortHead label="Transactions" sortKey="count" sort={sort} onSort={toggleSort} align="right" />
              <SortHead label="Income" sortKey="income" sort={sort} onSort={toggleSort} align="right" />
              <SortHead label="Expenses" sortKey="expense" sort={sort} onSort={toggleSort} align="right" />
              <SortHead label="Net" sortKey="net" sort={sort} onSort={toggleSort} align="right" />
              <TableHead className="hidden w-48 pr-4 md:table-cell">Share of expenses</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No income or expenses in this period.</TableCell>
              </TableRow>
            ) : sortedCategories.map(r => {
              const share = totalExpense > 0 ? (r.expense / totalExpense) * 100 : 0;
              return (
                <TableRow key={r.id}>
                  <TableCell className="pl-4">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                      {r.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.income ? formatCurrency(r.income) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.expense ? formatCurrency(r.expense) : '—'}</TableCell>
                  <TableCell className={`text-right tabular-nums ${r.net < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{signedCurrency(r.net)}</TableCell>
                  <TableCell className="hidden pr-4 md:table-cell">
                    {r.expense > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted">
                          <div className="h-1.5 rounded-full" style={{ width: `${share}%`, backgroundColor: colors.expense }} />
                        </div>
                        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {sortedCategories.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4">Total</TableCell>
                <TableCell className="text-right tabular-nums">{categoryRows.reduce((s, r) => s + r.count, 0)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totalIncome)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totalExpense)}</TableCell>
                <TableCell className="text-right tabular-nums">{signedCurrency(totalIncome - totalExpense)}</TableCell>
                <TableCell className="hidden pr-4 md:table-cell" />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Panel>

      {/* By user, accounts, loans */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="By user">
          {userRows.length === 0 ? <Empty>No income or expenses in this period.</Empty> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">User</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                  <TableHead className="pr-4 text-right">Expenses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRows.map(u => (
                  <TableRow key={u.name}>
                    <TableCell className="pl-4">{u.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(u.income)}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{formatCurrency(u.expense)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel title="Account balances" note="Today">
          {accounts.length === 0 ? <Empty>No accounts yet.</Empty> : (
            <Table>
              <TableBody>
                {accounts.map(a => (
                  <TableRow key={a.id} className={accountId === a.id ? 'bg-muted/50' : undefined}>
                    <TableCell className="pl-4">
                      <span className="flex items-center gap-2">
                        <AccountAvatar name={a.name} bankName={a.bankName} color={a.color} size="xs" />
                        {a.name}
                      </span>
                    </TableCell>
                    <TableCell className={`pr-4 text-right tabular-nums ${(a.balance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {signedCurrency(a.balance ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4">Total</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{signedCurrency(totalBalance)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </Panel>

        <Panel title="Open loans" note="Today">
          {openLoans.length === 0 ? <Empty>No open loans.</Empty> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Person</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="pr-4 text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openLoans.slice(0, 8).map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-4">
                      {l.person || 'Contact'}
                      {l.dueDate && <span className="block text-xs text-muted-foreground">Due {formatDayKey(dayKeyOf(l.dueDate))}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.type === 'given' ? 'Lent' : 'Borrowed'}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{formatCurrency(l.remaining)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>

      {activeGoals.length > 0 && (
        <Panel title="Savings goals" note={`Pace from the last 30 days: ${signedCurrency(dailySavings)} a day`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Goal</TableHead>
                <TableHead className="text-right">Saved</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="hidden w-56 md:table-cell">Progress</TableHead>
                <TableHead className="text-right">Needed a day</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeGoals.map(goal => {
                const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
                const deadline = dayKeyOf(goal.deadline);
                const daysLeft = deadline ? Math.max(0, dayCount({ start: today, end: deadline }) - 1) : 0;
                const needed = daysLeft > 0 ? remaining / daysLeft : remaining;
                const onTrack = dailySavings >= needed;
                return (
                  <TableRow key={goal.id}>
                    <TableCell className="pl-4">
                      {goal.title}
                      {deadline && <span className="block text-xs text-muted-foreground">By {formatDayKey(deadline)}, {daysLeft} days left</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(goal.currentAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(goal.targetAmount)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(progress, 100)} className="h-1.5 flex-1" />
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{progress.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(needed)}</TableCell>
                    <TableCell className="pr-4">
                      <span className={onTrack ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {onTrack ? 'On track' : 'Behind'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      )}
      </PageBody>
    </>
  );
}

/* ---------- building blocks ---------- */

function Panel({ title, note, actions, className, children }: { title: string; note?: string; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-lg border bg-card ${className ?? ''}`} aria-label={title}>
      <header className="flex min-h-11 items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
        <h2 className="text-sm font-semibold">
          {title}
          {note && <span className="ml-2 font-normal text-muted-foreground">{note}</span>}
        </h2>
        {actions}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function Kpi({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {children}
    </div>
  );
}

function Delta({ value, format, upIsGood }: { value: number; format: (n: number) => string; upIsGood: boolean }) {
  if (!Number.isFinite(value)) return null;
  const flat = Math.abs(value) < 0.005;
  const good = flat ? null : (value > 0) === upIsGood;
  const Icon = value > 0 ? ArrowUp : ArrowDown;
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs ${good === null ? 'text-muted-foreground' : good ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {!flat && <Icon className="h-3 w-3" aria-hidden />}
      {flat ? 'No change' : format(value)}
    </p>
  );
}

function PercentDelta({ current, previous, upIsGood }: { current: number; previous: number; upIsGood: boolean }) {
  if (previous === 0) return <p className="mt-1 text-xs text-muted-foreground">{current === 0 ? 'No change' : 'Nothing in the previous period'}</p>;
  return <Delta value={((current - previous) / previous) * 100} format={n => `${Math.abs(n).toFixed(1)}%`} upIsGood={upIsGood} />;
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

function ViewSwitch({ value, onChange }: { value: 'graph' | 'table'; onChange: (v: 'graph' | 'table') => void }) {
  return (
    <div className="flex rounded-md border p-0.5" role="group" aria-label="View">
      {(['graph', 'table'] as const).map(v => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${value === v ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function SortHead({ label, sortKey, sort, onSort, align, className }: {
  label: string;
  sortKey: 'name' | 'count' | 'income' | 'expense' | 'net';
  sort: { key: string; desc: boolean };
  onSort: (key: 'name' | 'count' | 'income' | 'expense' | 'net') => void;
  align?: 'right';
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = sort.desc ? ArrowDown : ArrowUp;
  return (
    <TableHead
      className={`${align === 'right' ? 'text-right' : ''} ${className ?? ''}`}
      aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground' : ''}`}
      >
        {label}
        {active && <Icon className="h-3 w-3" aria-hidden />}
      </button>
    </TableHead>
  );
}

function FlowRow({ label, value }: { label: string; value: number }) {
  return (
    <TableRow>
      <TableCell className="pl-4 text-muted-foreground">{label}</TableCell>
      <TableCell className="pr-4 text-right tabular-nums">{signedCurrency(value)}</TableCell>
    </TableRow>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-6 pt-2 text-sm text-muted-foreground">{children}</p>;
}

type TrendPoint = { long: string; income: number; expense: number; net: number };

function TrendTooltip({ active, payload, colors }: TooltipProps<number, string> & { colors: typeof CHART.light }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as TrendPoint;
  return (
    <div className="min-w-44 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
      <p className="mb-1.5 text-muted-foreground">{point.long}</p>
      <TooltipRow color={colors.income} label="Income" value={formatCurrency(point.income)} />
      <TooltipRow color={colors.expense} label="Expenses" value={formatCurrency(point.expense)} />
      <div className="mt-1.5 border-t pt-1.5">
        <TooltipRow label="Net" value={signedCurrency(point.net)} />
      </div>
    </div>
  );
}

function NetTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as TrendPoint;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
      <p className="mb-1 text-muted-foreground">{point.long}</p>
      <p className="text-sm font-semibold tabular-nums">{signedCurrency(point.net)}</p>
    </div>
  );
}

function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-2 text-muted-foreground">
        {color && <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: color }} aria-hidden />}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

type DataEndBarProps = { x?: number; y?: number; width?: number; height?: number; value?: number | number[]; positive: string; negative: string };

/** A column with 4px rounded corners on the data end and a square baseline, for positive and negative values. */
function DataEndBar({ x = 0, y = 0, width = 0, height = 0, value, positive, negative }: DataEndBarProps) {
  const v = Array.isArray(value) ? value[1] - value[0] : Number(value ?? 0);
  if (!width || !height || v === 0) return null;
  const top = Math.min(y, y + height);
  const h = Math.abs(height);
  const r = Math.min(4, h, width / 2);
  const right = x + width;
  const bottom = top + h;
  const d = v > 0
    ? `M${x},${bottom} L${x},${top + r} Q${x},${top} ${x + r},${top} L${right - r},${top} Q${right},${top} ${right},${top + r} L${right},${bottom} Z`
    : `M${x},${top} L${right},${top} L${right},${bottom - r} Q${right},${bottom} ${right - r},${bottom} L${x + r},${bottom} Q${x},${bottom} ${x},${bottom - r} Z`;
  return <path d={d} fill={v > 0 ? positive : negative} />;
}
