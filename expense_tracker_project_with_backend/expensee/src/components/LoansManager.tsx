import { Fragment, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePicker from '@/components/DatePicker';
import { AccountAvatar, Avatar, ControlPanel, GroupHeaderRows, PageBody, Sheet, StatusBar, Tag } from '@/components/erp';
import { apiClient } from '@/lib/api';
import { getUsers, getAccounts, getCategories, formatCurrency } from '@/lib/storage';
import { createDhakaTimestamp, formatDateDhaka } from '@/lib/dhakaTime';
import { dayKeyOf, todayKey } from '@/lib/dateRange';
import { loanRemaining, isLoanOpen } from '@/lib/finance';
import { User, Account, Category } from '@/components/types';
import { ChevronRight, Clock, LayoutGrid, List as ListIcon, MoreHorizontal, Plus, Search } from 'lucide-react';

interface LoansManagerProps {
  onDataChange: () => void;
}

const STATUS_LABEL: Record<string, string> = { pending: 'Open', partial: 'Partly repaid', paid: 'Repaid', repaid: 'Repaid', forgiven: 'Forgiven' };
const STATUS_TONE: Record<string, 'blue' | 'amber' | 'green' | 'violet'> = { pending: 'blue', partial: 'amber', paid: 'green', repaid: 'green', forgiven: 'violet' };

// Loan as returned from the server (snake_case)
interface ServerLoan {
  id: string;
  user_id: string;
  person: string;
  amount: number;
  type: 'given' | 'taken';
  description: string | null;
  date: string;
  due_date: string | null;
  status: 'pending' | 'paid' | 'partial' | 'forgiven';
  account_id?: string | null;
  repaid_amount?: number;
  repaid_date?: string | null;
  repaid_account_id?: string | null;
  forgiven_amount?: number;
  forgiven_date?: string | null;
  userId?: string; // for old loans
  created_at: string;
  updated_at: string;
}

export default function LoansManager({ onDataChange }: LoansManagerProps) {
  const [loans, setLoans] = useState<ServerLoan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('list');
  // Groups expanded in the list view; settled loans start collapsed
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['given', 'taken']));
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Add Loan Form State
  const [formData, setFormData] = useState({
    userId: '',
    amount: '',
    type: 'given' as 'given' | 'taken',
    accountId: '',
    recordTransaction: true,
    dueDate: '',
    loanDate: todayKey(),
    purpose: ''
  });

  // Repay Loan Modal State
  const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
  const [repayingLoan, setRepayingLoan] = useState<ServerLoan | null>(null);
  const [repayFormData, setRepayFormData] = useState({
    accountId: '',
    amount: '',
    date: '',
    notes: '',
  });
  const [repaySubmitting, setRepaySubmitting] = useState(false);

  // Forgive Loan Modal State
  const [isForgiveDialogOpen, setIsForgiveDialogOpen] = useState(false);
  const [forgivingLoan, setForgivingLoan] = useState<ServerLoan | null>(null);
  const [forgiveFormData, setForgiveFormData] = useState({
    categoryId: '',
    date: '',
    notes: '',
  });
  const [forgiveSubmitting, setForgiveSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rawLoans, usrs, accs, cats] = await Promise.all([
        apiClient.getLoans(),
        getUsers(),
        getAccounts(),
        getCategories(),
      ]);
      setLoans(rawLoans as ServerLoan[]);
      setUsers(usrs as User[]);
      setAccounts(accs as Account[]);
      setCategories(cats as Category[]);
    } catch (e) {
      console.error('LoansManager loadData error', e);
    }
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      amount: '',
      type: 'given',
      accountId: '',
      recordTransaction: true,
      dueDate: '',
      loanDate: todayKey(),
      purpose: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.userId || !formData.amount) {
      alert('Select a person and enter an amount.');
      return;
    }

    // person = the name of the selected financial user
    const selectedUser = users.find(u => u.id === formData.userId);
    if (!selectedUser) {
      alert('Selected user not found');
      return;
    }

    try {
      await apiClient.createLoan({
        person:             selectedUser.name,
        amount:             parseFloat(formData.amount),
        type:               formData.type,
        description:        formData.purpose.trim() || null,
        date:               createDhakaTimestamp(formData.loanDate || todayKey()),
        due_date:           formData.dueDate ? `${formData.dueDate}T00:00:00+06:00` : null,
        status:             'pending',
        account_id:         formData.accountId || null,
        record_transaction: formData.recordTransaction && !!formData.accountId,
        financial_user_id:  selectedUser.id,
      });

      await loadData();
      onDataChange();
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      alert(`Failed to create loan: ${(err as Error).message}`);
    }
  };

  const openRepayDialog = (loan: ServerLoan) => {
    const personName = loan.person || users.find(u => u.id === loan.userId)?.name || 'Contact';
    const remainingAmount = Math.max(0, loan.amount - (loan.repaid_amount || 0));
    const defaultAccountId = loan.account_id || (accounts.length > 0 ? accounts[0].id : '');
    
    setRepayingLoan(loan);
    setRepayFormData({
      accountId: defaultAccountId,
      amount: remainingAmount > 0 ? remainingAmount.toString() : loan.amount.toString(),
      date: todayKey(),
      notes: loan.type === 'given' 
        ? `Loan repayment received from ${personName}` 
        : `Loan repayment paid to ${personName}`,
    });
    setIsRepayDialogOpen(true);
  };

  const handleConfirmRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayingLoan) return;

    if (!repayFormData.accountId) {
      alert('Select the account the repayment goes through.');
      return;
    }

    const repayAmt = parseFloat(repayFormData.amount);
    if (isNaN(repayAmt) || repayAmt <= 0) {
      alert('Enter a repayment amount greater than 0.');
      return;
    }

    setRepaySubmitting(true);
    try {
      await apiClient.repayLoan(repayingLoan.id, {
        account_id: repayFormData.accountId,
        amount: repayAmt,
        date: createDhakaTimestamp(repayFormData.date || todayKey()),
        notes: repayFormData.notes,
      });

      await loadData();
      onDataChange();
      setIsRepayDialogOpen(false);
      setRepayingLoan(null);
    } catch (err) {
      alert(`Failed to record loan repayment: ${(err as Error).message}`);
    } finally {
      setRepaySubmitting(false);
    }
  };

  const openForgiveDialog = (loan: ServerLoan) => {
    const personName = loan.person || users.find(u => u.id === loan.userId)?.name || 'Contact';
    const remainingAmount = Math.max(0, loan.amount - (loan.repaid_amount || 0));
    const forgivenCat = categories.find(c => c.name.toLowerCase().includes('forgiven') || c.name.toLowerCase().includes('bad debt'));

    setForgivingLoan(loan);
    setForgiveFormData({
      categoryId: forgivenCat ? forgivenCat.id : (categories[0]?.id || ''),
      date: todayKey(),
      notes: `Forgiven loan to ${personName} (walked over)`,
    });
    setIsForgiveDialogOpen(true);
  };

  const handleConfirmForgive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgivingLoan) return;

    setForgiveSubmitting(true);
    try {
      await apiClient.forgiveLoan(forgivingLoan.id, {
        category_id: forgiveFormData.categoryId || undefined,
        date: createDhakaTimestamp(forgiveFormData.date || todayKey()),
        notes: forgiveFormData.notes,
      });

      await loadData();
      onDataChange();
      setIsForgiveDialogOpen(false);
      setForgivingLoan(null);
    } catch (err) {
      alert(`Failed to forgive loan: ${(err as Error).message}`);
    } finally {
      setForgiveSubmitting(false);
    }
  };

  const handleDeleteLoan = async (loanId: string) => {
    if (confirm('Delete this loan? Its linked transactions (the loan itself, repayments and any write-off) are deleted too, so account balances change to match.')) {
      try {
        await apiClient.deleteLoan(loanId);
        await loadData();
        onDataChange();
      } catch (err) {
        alert(`Failed to delete loan: ${(err as Error).message}`);
      }
    }
  };

  const filteredLoans = loans.filter((loan) => {
    const searchValue = searchTerm.toLowerCase();
    const person = loan.person?.toLowerCase() || '';
    const description = loan.description?.toLowerCase() || '';

    const matchesSearch =
      !searchValue ||
      person.includes(searchValue) ||
      description.includes(searchValue);

    const matchesType = filterType === 'all' || loan.type === filterType;
    // server status: 'pending' | 'paid' | 'partial' | 'forgiven'
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'pending' && isLoanOpen(loan)) ||
      (filterStatus === 'partial' && loan.status === 'partial') ||
      (filterStatus === 'paid' && (loan.status === 'paid' || (loan.status as string) === 'repaid')) ||
      (filterStatus === 'repaid' && (loan.status === 'paid' || (loan.status as string) === 'repaid')) ||
      (filterStatus === 'forgiven' && loan.status === 'forgiven');

    return matchesSearch && matchesType && matchesStatus;
  }).sort((a, b) => {
    const openA = isLoanOpen(a);
    const openB = isLoanOpen(b);
    if (openA !== openB) {
      return openA ? -1 : 1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const today = todayKey();
  const personOf = (loan: ServerLoan) => loan.person || users.find(u => u.id === loan.userId || u.id === loan.user_id)?.name || 'Contact';
  const remainingOf = (loan: ServerLoan) => loanRemaining(loan as unknown as Parameters<typeof loanRemaining>[0]);
  const isOverdue = (loan: ServerLoan) => !!loan.due_date && isLoanOpen(loan) && dayKeyOf(loan.due_date) < today;
  const isSettled = (loan: ServerLoan) => !isLoanOpen(loan);

  const sideStats = (type: 'given' | 'taken') => {
    const list = loans.filter(l => l.type === type);
    const open = list.filter(l => isLoanOpen(l));
    const overdue = open.filter(isOverdue);
    return {
      total: list.reduce((s, l) => s + l.amount, 0),
      repaid: list.reduce((s, l) => s + Number(l.repaid_amount || 0), 0),
      remaining: open.reduce((s, l) => s + remainingOf(l), 0),
      openCount: open.length,
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, l) => s + remainingOf(l), 0),
    };
  };
  const lent = sideStats('given');
  const borrowed = sideStats('taken');
  const net = lent.remaining - borrowed.remaining;

  const groups = [
    { key: 'given', label: 'Owed to you', rows: filteredLoans.filter(l => l.type === 'given' && isLoanOpen(l)) },
    { key: 'taken', label: 'You owe', rows: filteredLoans.filter(l => l.type === 'taken' && isLoanOpen(l)) },
    { key: 'settled', label: 'Settled', rows: filteredLoans.filter(isSettled) },
  ].filter(g => g.rows.length > 0);

  const stages = [
    { key: 'pending', label: 'Open', rows: filteredLoans.filter(l => l.status === 'pending' && isLoanOpen(l)) },
    { key: 'partial', label: 'Partly repaid', rows: filteredLoans.filter(l => l.status === 'partial' && isLoanOpen(l)) },
    { key: 'settled', label: 'Settled', rows: filteredLoans.filter(isSettled) },
  ];

  const toggleGroup = (key: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const loanActions = (loan: ServerLoan, compact = false) => (
    <div className="flex items-center justify-end gap-1">
      {isLoanOpen(loan) && (
        <Button size="sm" variant={compact ? 'ghost' : 'secondary'} className={compact ? 'h-7 px-2 text-primary hover:text-primary' : 'hidden sm:inline-flex'} onClick={() => openRepayDialog(loan)}>
          Repay
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`More actions for ${personOf(loan)}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isLoanOpen(loan) && <DropdownMenuItem onSelect={() => openRepayDialog(loan)}>Record repayment</DropdownMenuItem>}
          {isLoanOpen(loan) && loan.type === 'given' && <DropdownMenuItem onSelect={() => openForgiveDialog(loan)}>Forgive remaining amount</DropdownMenuItem>}
          {isLoanOpen(loan) && <DropdownMenuSeparator />}
          <DropdownMenuItem className="text-red-600 focus:text-red-600 dark:text-red-400" onSelect={() => handleDeleteLoan(loan.id)}>Delete loan</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const statusTag = (loan: ServerLoan) => (
    <span className="flex flex-wrap items-center gap-1">
      <Tag tone={STATUS_TONE[loan.status] ?? 'gray'}>{STATUS_LABEL[loan.status] ?? loan.status}</Tag>
      {isOverdue(loan) && <Tag tone="red">Overdue</Tag>}
    </span>
  );

  const repaidBar = (loan: ServerLoan) => {
    const repaid = Number(loan.repaid_amount || 0);
    const pct = loan.amount > 0 ? Math.min(100, (repaid / loan.amount) * 100) : 0;
    return (
      <div className="flex min-w-28 items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted">
          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
      </div>
    );
  };

  const remainingForm = repayingLoan ? remainingOf(repayingLoan) : 0;
  const repayAccount = accounts.find(a => a.id === repayFormData.accountId);
  const forgiveAmount = forgivingLoan ? remainingOf(forgivingLoan) : 0;

  return (
    <>
      <ControlPanel
        title="Loans"
        actions={
          <Button size="sm" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden />
            New
          </Button>
        }
      >
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            id="loan-search"
            aria-label="Search loans"
            placeholder="Search person or purpose"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger aria-label="Type" className="h-8 w-44 text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Lent and borrowed</SelectItem>
            <SelectItem value="given">Lent</SelectItem>
            <SelectItem value="taken">Borrowed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger aria-label="Status" className="h-8 w-40 text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Open</SelectItem>
            <SelectItem value="partial">Partly repaid</SelectItem>
            <SelectItem value="paid">Repaid</SelectItem>
            <SelectItem value="forgiven">Forgiven</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-md border bg-card p-0.5" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'list'} aria-label="List view" onClick={() => setView('list')}
            className={`inline-flex h-7 w-8 items-center justify-center rounded ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <ListIcon className="h-4 w-4" />
          </button>
          <button type="button" aria-pressed={view === 'kanban'} aria-label="Kanban view" onClick={() => setView('kanban')}
            className={`inline-flex h-7 w-8 items-center justify-center rounded ${view === 'kanban' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </ControlPanel>

      <PageBody>
        {/* Receivables, payables, net */}
        <section className="grid grid-cols-1 overflow-hidden rounded-lg border bg-card md:grid-cols-[1fr_1fr_minmax(0,0.8fr)] md:divide-x" aria-label="Loan summary">
          {([
            ['Owed to you', lent, 'lent'],
            ['You owe', borrowed, 'borrowed'],
          ] as const).map(([label, stats, verb]) => (
            <div key={label} className="space-y-3 border-b p-4 md:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(stats.remaining)}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{stats.openCount} open {stats.openCount === 1 ? 'loan' : 'loans'}</p>
                  {stats.overdueCount > 0 && (
                    <p className="mt-1"><Tag tone="red">{stats.overdueCount} overdue, {formatCurrency(stats.overdueAmount)}</Tag></p>
                  )}
                </div>
              </div>
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${stats.total > 0 ? (stats.repaid / stats.total) * 100 : 0}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Repaid <span className="font-medium tabular-nums text-foreground">{formatCurrency(stats.repaid)}</span> of {formatCurrency(stats.total)} {verb}
                </p>
              </div>
            </div>
          ))}
          <div className="p-4">
            <p className="text-sm text-muted-foreground">Net position</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${net < 0 ? 'text-red-600 dark:text-red-400' : net > 0 ? 'text-green-700 dark:text-green-400' : ''}`}>
              {net < 0 ? '-' : net > 0 ? '+' : ''}{formatCurrency(Math.abs(net))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {net < 0 ? 'You owe more than you are owed.' : net > 0 ? 'You are owed more than you owe.' : 'Even.'}
            </p>
          </div>
        </section>

        {filteredLoans.length === 0 ? (
          <Sheet>
            <div className="px-6 py-16 text-center">
              <p className="font-medium">No loans</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {users.length === 0
                  ? 'Add a user in the Users tab, then record a loan.'
                  : loans.length > 0
                    ? 'Nothing matches these filters. Clear the search or a filter to see more.'
                    : 'Record money you lent or borrowed to track repayments.'}
              </p>
            </div>
          </Sheet>
        ) : view === 'list' ? (
          <Sheet bodyClassName="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Person</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Due</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Amount</TableHead>
                  <TableHead className="hidden lg:table-cell">Repaid</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="pr-3 text-right sm:w-32"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map(group => {
                  const open = expanded.has(group.key);
                  const subtotal = group.rows.reduce((s, l) => s + remainingOf(l), 0);
                  return (
                    <Fragment key={group.key}>
                      <GroupHeaderRows
                        spans={{ xs: [1, 1], sm: [2, 2], md: [4, 2], lg: [5, 2] }}
                        rowClassName="bg-muted/40 hover:bg-muted/60"
                        labelClassName="pl-2"
                        subtotalClassName="font-semibold tabular-nums"
                        subtotal={group.key === 'settled' ? '' : formatCurrency(subtotal)}
                        label={
                          <button type="button" aria-expanded={open} onClick={() => toggleGroup(group.key)}
                            className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold">
                            <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
                            {group.label}
                            <span className="font-normal text-muted-foreground">({group.rows.length})</span>
                          </button>
                        }
                      />
                      {open && group.rows.map(loan => {
                        const person = personOf(loan);
                        return (
                          <TableRow key={loan.id} className={isSettled(loan) ? 'text-muted-foreground' : undefined}>
                            <TableCell className="pl-4">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={person} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">{person}</p>
                                  {loan.description && <p className="truncate text-xs text-muted-foreground">{loan.description}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden whitespace-nowrap tabular-nums text-muted-foreground md:table-cell">{formatDateDhaka(loan.date || loan.created_at)}</TableCell>
                            <TableCell className={`hidden whitespace-nowrap tabular-nums md:table-cell ${isOverdue(loan) ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                              {loan.due_date ? formatDateDhaka(loan.due_date) : '—'}
                            </TableCell>
                            <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(loan.amount)}</TableCell>
                            <TableCell className="hidden lg:table-cell">{repaidBar(loan)}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{isSettled(loan) ? '—' : formatCurrency(remainingOf(loan))}</TableCell>
                            <TableCell className="hidden sm:table-cell">{statusTag(loan)}</TableCell>
                            <TableCell className="pr-3">{loanActions(loan)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Sheet>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            {stages.map(stage => (
              <div key={stage.key} className="rounded-lg bg-muted/60 p-2 dark:bg-muted/30">
                <div className="flex items-baseline justify-between px-2 pb-2 pt-1">
                  <h2 className="text-sm font-semibold">
                    {stage.label} <span className="font-normal text-muted-foreground">({stage.rows.length})</span>
                  </h2>
                  {stage.key !== 'settled' && (
                    <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(stage.rows.reduce((s, l) => s + remainingOf(l), 0))}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {stage.rows.length === 0 && <p className="px-2 pb-2 text-xs text-muted-foreground">Nothing here.</p>}
                  {stage.rows.map(loan => {
                    const person = personOf(loan);
                    const settled = isSettled(loan);
                    return (
                      <article key={loan.id} className="rounded-md border bg-card p-3 shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <Avatar name={person} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="truncate text-sm font-semibold">{person}</h3>
                              <Tag tone={loan.type === 'given' ? 'amber' : 'blue'}>{loan.type === 'given' ? 'Lent' : 'Borrowed'}</Tag>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{loan.description || 'No purpose noted'}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-baseline justify-between gap-2">
                          <span className="text-lg font-semibold tabular-nums">{formatCurrency(settled ? loan.amount : remainingOf(loan))}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {settled ? (loan.status === 'forgiven' ? 'Forgiven' : 'Repaid in full') : `left of ${formatCurrency(loan.amount)}`}
                          </span>
                        </div>
                        {!settled && <div className="mt-2">{repaidBar(loan)}</div>}

                        <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
                          <span className={`flex items-center gap-1 text-xs ${isOverdue(loan) ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            {settled
                              ? `Closed ${formatDateDhaka(loan.forgiven_date || loan.repaid_date || loan.updated_at)}`
                              : loan.due_date ? `Due ${formatDateDhaka(loan.due_date)}${isOverdue(loan) ? ', overdue' : ''}` : 'No due date'}
                          </span>
                          {loanActions(loan, true)}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>

      {/* New loan */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh_-_2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New loan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1" role="radiogroup" aria-label="Loan type">
              {([['given', 'I lent money'], ['taken', 'I borrowed money']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={formData.type === value}
                  onClick={() => setFormData({ ...formData, type: value })}
                  className={`rounded px-3 py-1.5 text-sm transition-colors ${formData.type === value ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="loanPerson">{formData.type === 'given' ? 'Lent to' : 'Borrowed from'}</Label>
                <Select value={formData.userId} onValueChange={(value) => setFormData({ ...formData, userId: value })}>
                  <SelectTrigger id="loanPerson"><SelectValue placeholder="Select a person" /></SelectTrigger>
                  <SelectContent>
                    {users.length > 0
                      ? users.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)
                      : <div className="p-2 text-sm text-muted-foreground">Add people in the Users tab first.</div>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loanAmount">Amount</Label>
                <Input id="loanAmount" type="number" inputMode="decimal" step="0.01" min="0" value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loanPurpose">Purpose</Label>
              <Input id="loanPurpose" value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="For example, medical bills" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="loanDate">Date</Label>
                <DatePicker id="loanDate" value={formData.loanDate} onChange={(v) => setFormData({ ...formData, loanDate: v || todayKey() })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loanDue">Due date</Label>
                <DatePicker id="loanDue" value={formData.dueDate} onChange={(v) => setFormData({ ...formData, dueDate: v })} placeholder="No due date" clearable />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loanAccount">{formData.type === 'given' ? 'Paid from' : 'Received into'}</Label>
              <Select value={formData.accountId || 'none'} onValueChange={(val) => setFormData({ ...formData, accountId: val === 'none' ? '' : val })}>
                <SelectTrigger id="loanAccount"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account (track only)</SelectItem>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}><span className="flex items-center gap-2"><AccountAvatar name={acc.name} bankName={acc.bankName} color={acc.color} size="xs" />{acc.name} ({formatCurrency(acc.balance ?? acc.currentBalance ?? 0)})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.accountId && formData.amount && (
                <p className="text-xs text-muted-foreground">
                  {formData.type === 'given' ? 'Takes' : 'Adds'} {formatCurrency(Number(formData.amount) || 0)} {formData.type === 'given' ? 'from' : 'to'} {accounts.find(a => a.id === formData.accountId)?.name}.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={users.length === 0}>Create loan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record repayment */}
      <Dialog open={isRepayDialogOpen} onOpenChange={setIsRepayDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh_-_2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record repayment</DialogTitle>
          </DialogHeader>
          {repayingLoan && (
            <form onSubmit={handleConfirmRepay} className="space-y-4">
              <StatusBar steps={['Open', 'Partly repaid', 'Repaid']} current={repayingLoan.status === 'partial' ? 1 : 0} />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
                <dt className="text-muted-foreground">{repayingLoan.type === 'given' ? 'Borrower' : 'Lender'}</dt>
                <dd className="text-right font-medium">{personOf(repayingLoan)}</dd>
                <dt className="text-muted-foreground">Loan amount</dt>
                <dd className="text-right tabular-nums">{formatCurrency(repayingLoan.amount)}</dd>
                <dt className="text-muted-foreground">Repaid so far</dt>
                <dd className="text-right tabular-nums">{formatCurrency(Number(repayingLoan.repaid_amount || 0))}</dd>
                <dt className="font-medium">Remaining</dt>
                <dd className="text-right font-semibold tabular-nums">{formatCurrency(remainingForm)}</dd>
              </dl>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="mb-1.5 flex h-3.5 items-center justify-between">
                    <Label htmlFor="repayAmount">Amount</Label>
                    {Number(repayFormData.amount) !== remainingForm && (
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setRepayFormData({ ...repayFormData, amount: String(remainingForm) })}>
                        Full amount
                      </button>
                    )}
                  </div>
                  <Input id="repayAmount" type="number" inputMode="decimal" step="0.01" min="0.01" max={remainingForm || undefined} required
                    value={repayFormData.amount} onChange={(e) => setRepayFormData({ ...repayFormData, amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="repayDate">Date</Label>
                  <DatePicker id="repayDate" value={repayFormData.date} onChange={(v) => setRepayFormData({ ...repayFormData, date: v || todayKey() })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="repayAccount">{repayingLoan.type === 'given' ? 'Received into' : 'Paid from'}</Label>
                <Select value={repayFormData.accountId} onValueChange={(val) => setRepayFormData({ ...repayFormData, accountId: val })}>
                  <SelectTrigger id="repayAccount"><SelectValue placeholder="Select an account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}><span className="flex items-center gap-2"><AccountAvatar name={acc.name} bankName={acc.bankName} color={acc.color} size="xs" />{acc.name} ({formatCurrency(acc.balance ?? acc.currentBalance ?? 0)})</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {repayAccount && Number(repayFormData.amount) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {repayingLoan.type === 'given' ? 'Adds' : 'Takes'} {formatCurrency(Number(repayFormData.amount))} {repayingLoan.type === 'given' ? 'to' : 'from'} {repayAccount.name}.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="repayNotes">Note</Label>
                <Input id="repayNotes" value={repayFormData.notes} onChange={(e) => setRepayFormData({ ...repayFormData, notes: e.target.value })} />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsRepayDialogOpen(false)} disabled={repaySubmitting}>Cancel</Button>
                <Button type="submit" disabled={repaySubmitting || accounts.length === 0}>
                  {repaySubmitting ? 'Saving…' : 'Record repayment'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Forgive */}
      <Dialog open={isForgiveDialogOpen} onOpenChange={setIsForgiveDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh_-_2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Forgive loan</DialogTitle>
          </DialogHeader>
          {forgivingLoan && (
            <form onSubmit={handleConfirmForgive} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The remaining {formatCurrency(forgiveAmount)} that {personOf(forgivingLoan)} owes you is recorded as an expense, and the loan is closed. No money moves between accounts.
              </p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
                <dt className="text-muted-foreground">Loan amount</dt>
                <dd className="text-right tabular-nums">{formatCurrency(forgivingLoan.amount)}</dd>
                <dt className="text-muted-foreground">Repaid so far</dt>
                <dd className="text-right tabular-nums">{formatCurrency(Number(forgivingLoan.repaid_amount || 0))}</dd>
                <dt className="font-medium">To forgive</dt>
                <dd className="text-right font-semibold tabular-nums">{formatCurrency(forgiveAmount)}</dd>
              </dl>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="forgiveCategory">Expense category</Label>
                  <Select value={forgiveFormData.categoryId} onValueChange={(val) => setForgiveFormData({ ...forgiveFormData, categoryId: val })}>
                    <SelectTrigger id="forgiveCategory"><SelectValue placeholder="Select a category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="forgiveDate">Date</Label>
                  <DatePicker id="forgiveDate" value={forgiveFormData.date} onChange={(v) => setForgiveFormData({ ...forgiveFormData, date: v || todayKey() })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forgiveNotes">Reason</Label>
                <Input id="forgiveNotes" value={forgiveFormData.notes} onChange={(e) => setForgiveFormData({ ...forgiveFormData, notes: e.target.value })} />
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsForgiveDialogOpen(false)} disabled={forgiveSubmitting}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={forgiveSubmitting}>
                  {forgiveSubmitting ? 'Saving…' : `Forgive ${formatCurrency(forgiveAmount)}`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
