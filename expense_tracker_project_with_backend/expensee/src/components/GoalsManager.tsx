import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getTransactions, formatCurrency } from '@/lib/storage';
import { apiClient } from '@/lib/api';
import { formatDateDhaka } from '@/lib/dhakaTime';
import { ControlPanel, PageBody, Scorecard, Sheet, Tag } from '@/components/erp';
import { Star } from 'lucide-react';
import { Goal, Transaction } from '@/types';
import {
  Plus,
  Edit,
  Trash2,
  Target,
  TrendingUp,
  Calendar,
  Wallet,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Zap,
  Clock,
  PiggyBank,
  ArrowUpRight,
  AlertTriangle
} from 'lucide-react';

interface GoalsManagerProps {
  onDataChange: () => void;
}

export default function GoalsManager({ onDataChange }: GoalsManagerProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [addFundsGoalId, setAddFundsGoalId] = useState<string | null>(null);
  const [addFundsAmount, setAddFundsAmount] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetAmount: '',
    currentAmount: '',
    deadline: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rawGoals, txns] = await Promise.all([
        apiClient.getGoals(),
        getTransactions(),
      ]);
      const gls = (rawGoals as Record<string, unknown>[]).map(mapServerGoal);
      setGoals(gls as Goal[]);
      setTransactions(txns as Transaction[]);
    } catch (e) {
      console.error('GoalsManager loadData error', e);
    }
  };

  /** Map server snake_case goal to frontend camelCase Goal */
  const mapServerGoal = (g: Record<string, unknown>): Goal => ({
    id:            String(g.id ?? ''),
    title:         String(g.name ?? ''),
    description:   g.description ? String(g.description) : undefined,
    targetAmount:  Number(g.target_amount ?? 0),
    currentAmount: Number(g.current_amount ?? 0),
    deadline:      String(g.deadline ?? ''),
    priority:      (g.priority as Goal['priority']) || 'medium',
    status:        (g.status as Goal['status']) || 'active',
    createdAt:     String(g.created_at ?? ''),
    updatedAt:     String(g.updated_at ?? ''),
  });

  // Calculate financial insights from transactions
  const financialInsights = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = transactions.filter(t => new Date(t.date) >= thirtyDaysAgo);

    const monthlyIncome = recentTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = recentTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const dailyAvgExpense = monthlyExpenses / 30;
    const dailyAvgIncome = monthlyIncome / 30;
    const dailySavings = dailyAvgIncome - dailyAvgExpense;

    return {
      monthlyIncome,
      monthlyExpenses,
      monthlySavings: monthlyIncome - monthlyExpenses,
      dailyAvgExpense,
      dailyAvgIncome,
      dailySavings,
    };
  }, [transactions]);

  // Calculate goal insights
  const getGoalInsights = (goal: Goal) => {
    const remaining = goal.targetAmount - goal.currentAmount;
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    const deadlineDate = new Date(goal.deadline);
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const dailySavingsNeeded = daysRemaining > 0 ? remaining / daysRemaining : remaining;
    const monthlySavingsNeeded = dailySavingsNeeded * 30;

    // Auto-detect: how many days needed based on current savings rate
    const daysNeededAtCurrentRate = financialInsights.dailySavings > 0
      ? Math.ceil(remaining / financialInsights.dailySavings)
      : Infinity;

    // How much to cut daily spending
    const dailyCutNeeded = daysRemaining > 0
      ? Math.max(0, dailySavingsNeeded - financialInsights.dailySavings)
      : 0;

    const isOnTrack = financialInsights.dailySavings >= dailySavingsNeeded;
    const isOverdue = daysRemaining === 0 && remaining > 0;

    return {
      remaining,
      progress: Math.min(progress, 100),
      daysRemaining,
      dailySavingsNeeded,
      monthlySavingsNeeded,
      daysNeededAtCurrentRate,
      dailyCutNeeded,
      isOnTrack,
      isOverdue,
    };
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      targetAmount: '',
      currentAmount: '',
      deadline: '',
      priority: 'medium',
    });
    setEditingGoal(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.targetAmount || !formData.deadline) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const currentAmt = parseFloat(formData.currentAmount || '0');
      const targetAmt  = parseFloat(formData.targetAmount);
      const autoStatus = currentAmt >= targetAmt ? 'completed' : formData.priority === 'high' ? 'active' : 'active';

      const payload = {
        name:           formData.title,
        description:    formData.description || null,
        target_amount:  targetAmt,
        current_amount: currentAmt,
        deadline:       new Date(formData.deadline).toISOString(),
        priority:       formData.priority,
        status:         currentAmt >= targetAmt ? 'completed' as const : autoStatus as 'active',
      };

      if (editingGoal) {
        await apiClient.updateGoal(editingGoal.id, payload);
      } else {
        await apiClient.createGoal(payload);
      }

      await loadData();
      onDataChange();
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      alert(`Failed to save goal: ${(err as Error).message}`);
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || '',
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      deadline: goal.deadline.split('T')[0],
      priority: goal.priority,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      try {
        await apiClient.deleteGoal(id);
        await loadData();
        onDataChange();
      } catch (err) {
        alert(`Failed to delete goal: ${(err as Error).message}`);
      }
    }
  };

  const handleToggleStatus = async (goal: Goal) => {
    const newStatus = goal.status === 'active' ? 'paused' : 'active';
    try {
      await apiClient.updateGoal(goal.id, { status: newStatus });
      await loadData();
      onDataChange();
    } catch (err) {
      alert(`Failed to update goal: ${(err as Error).message}`);
    }
  };

  const handleAddFunds = async (goalId: string) => {
    if (!addFundsAmount || parseFloat(addFundsAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(addFundsAmount);
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const newCurrent = goal.currentAmount + amount;
    const newStatus  = newCurrent >= goal.targetAmount ? 'completed' as const : goal.status;

    try {
      await apiClient.updateGoal(goalId, {
        current_amount: newCurrent,
        status:         newStatus,
      });
      await loadData();
      onDataChange();
      setAddFundsGoalId(null);
      setAddFundsAmount('');
    } catch (err) {
      alert(`Failed to add funds: ${(err as Error).message}`);
    }
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const pausedGoals = goals.filter(g => g.status === 'paused');

  const totalTargetAmount = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSavedAmount = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallProgress = totalTargetAmount > 0 ? (totalSavedAmount / totalTargetAmount) * 100 : 0;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'low': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      default: return '';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 75) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <>
      <ControlPanel
        title="Savings goals"
        actions={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm}>
                  <Plus className="h-4 w-4" aria-hidden />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingGoal ? 'Edit Goal' : 'Create New Savings Goal'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="goalTitle">Goal Title *</Label>
                    <Input
                      id="goalTitle"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., New Laptop, Emergency Fund"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="goalDescription">Description</Label>
                    <Textarea
                      id="goalDescription"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional description for your goal"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="goalTarget">Target Amount *</Label>
                      <Input
                        id="goalTarget"
                        type="number"
                        step="0.01"
                        value={formData.targetAmount}
                        onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="goalCurrent">Already Saved</Label>
                      <Input
                        id="goalCurrent"
                        type="number"
                        step="0.01"
                        value={formData.currentAmount}
                        onChange={(e) => setFormData({ ...formData, currentAmount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="goalDeadline">Deadline *</Label>
                      <Input
                        id="goalDeadline"
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="goalPriority">Priority</Label>
                      <Select value={formData.priority} onValueChange={(value: 'low' | 'medium' | 'high') => setFormData({ ...formData, priority: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">🟢 Low</SelectItem>
                          <SelectItem value="medium">🟡 Medium</SelectItem>
                          <SelectItem value="high">🔴 High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Smart Preview */}
                  {formData.targetAmount && formData.deadline && (
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4 space-y-2">
                        <p className="text-sm font-medium flex items-center gap-1">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          Smart Savings Preview
                        </p>
                        {(() => {
                          const target = parseFloat(formData.targetAmount) || 0;
                          const current = parseFloat(formData.currentAmount || '0');
                          const remaining = target - current;
                          const deadlineDate = new Date(formData.deadline);
                          const now = new Date();
                          const daysLeft = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                          const dailyNeeded = daysLeft > 0 ? remaining / daysLeft : remaining;
                          const monthlyNeeded = dailyNeeded * 30;

                          return (
                            <div className="text-xs space-y-1 text-muted-foreground">
                              <p>📅 {daysLeft} days until deadline</p>
                              <p>💰 Need to save: {formatCurrency(dailyNeeded)}/day or {formatCurrency(monthlyNeeded)}/month</p>
                              {financialInsights.dailySavings > 0 && (
                                <p className={financialInsights.dailySavings >= dailyNeeded ? 'text-green-600' : 'text-red-600'}>
                                  {financialInsights.dailySavings >= dailyNeeded
                                    ? `✅ On track! Your current savings rate (${formatCurrency(financialInsights.dailySavings)}/day) is sufficient`
                                    : `⚠️ Need to save ${formatCurrency(dailyNeeded - financialInsights.dailySavings)} more per day`
                                  }
                                </p>
                              )}
                              {financialInsights.dailySavings > 0 && (
                                <p>🕐 At current rate: ~{Math.ceil(remaining / financialInsights.dailySavings)} days needed</p>
                              )}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingGoal ? 'Update Goal' : 'Create Goal'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
        }
      />

      <PageBody>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Scorecard label="Active goals" value={String(activeGoals.length)} delta={<p className="text-xs text-muted-foreground">{completedGoals.length} completed, {pausedGoals.length} paused</p>} />
          <Scorecard label="Saved" value={formatCurrency(totalSavedAmount)} delta={<p className="text-xs text-muted-foreground">of {formatCurrency(totalTargetAmount)}</p>} />
          <Scorecard label="Overall progress" value={`${overallProgress.toFixed(1)}%`} delta={<Progress value={overallProgress} className="mt-1 h-1.5" />} />
          <Scorecard
            label="Daily savings, last 30 days"
            value={`${financialInsights.dailySavings < 0 ? '-' : ''}${formatCurrency(Math.abs(financialInsights.dailySavings))}`}
            delta={<p className="text-xs text-muted-foreground">{financialInsights.dailySavings >= 0 ? 'Saved per day' : 'Overspent per day'}</p>}
          />
        </div>

        {goals.length === 0 ? (
          <Sheet>
            <div className="px-6 py-16 text-center">
              <p className="font-medium">No savings goals</p>
              <p className="mt-1 text-sm text-muted-foreground">Set a target and a deadline to see the daily amount you need to save.</p>
              <Button className="mt-4" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4" aria-hidden />
                New goal
              </Button>
            </div>
          </Sheet>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            {([
              ['Active', activeGoals],
              ['Paused', pausedGoals],
              ['Completed', completedGoals],
            ] as const).map(([stage, list]) => (
              <div key={stage} className="rounded-lg bg-muted/60 p-2 dark:bg-muted/30">
                <div className="flex items-baseline justify-between px-2 pb-2 pt-1">
                  <h2 className="text-sm font-semibold">
                    {stage} <span className="font-normal text-muted-foreground">({list.length})</span>
                  </h2>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(list.reduce((s, g) => s + g.currentAmount, 0))}
                  </span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 && <p className="px-2 pb-2 text-xs text-muted-foreground">No {stage.toLowerCase()} goals.</p>}
                  {list.map(goal => {
                    const insights = getGoalInsights(goal);
                    const stars = goal.priority === 'high' ? 3 : goal.priority === 'medium' ? 2 : 1;
                    return (
                      <article key={goal.id} className="rounded-md border bg-card p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">{goal.title}</h3>
                            {goal.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{goal.description}</p>}
                          </div>
                          <span className="flex shrink-0" aria-label={`${goal.priority} priority`} title={`${goal.priority} priority`}>
                            {[1, 2, 3].map(n => (
                              <Star key={n} className={`h-3.5 w-3.5 ${n <= stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} aria-hidden />
                            ))}
                          </span>
                        </div>

                        <div className="mt-3">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-sm font-semibold tabular-nums">{formatCurrency(goal.currentAmount)}</span>
                            <span className="tabular-nums text-muted-foreground">of {formatCurrency(goal.targetAmount)}</span>
                          </div>
                          <Progress value={stage === 'Completed' ? 100 : insights.progress} className="mt-1.5 h-1.5" />
                        </div>

                        {stage === 'Active' && (
                          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <dt className="text-muted-foreground">Needed a day</dt>
                            <dd className="text-right tabular-nums">{formatCurrency(insights.dailySavingsNeeded)}</dd>
                            <dt className="text-muted-foreground">Needed a month</dt>
                            <dd className="text-right tabular-nums">{formatCurrency(insights.monthlySavingsNeeded)}</dd>
                            <dt className="text-muted-foreground">At current pace</dt>
                            <dd className="text-right tabular-nums">
                              {insights.daysNeededAtCurrentRate === Infinity ? 'Not saving' : `${insights.daysNeededAtCurrentRate} days`}
                            </dd>
                          </dl>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          {stage === 'Completed' ? (
                            <Tag tone="green">Completed {formatDateDhaka(goal.updatedAt)}</Tag>
                          ) : (
                            <>
                              <span className={`flex items-center gap-1 ${insights.isOverdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                                <Clock className="h-3.5 w-3.5" aria-hidden />
                                {insights.isOverdue ? 'Overdue' : `${insights.daysRemaining} days left`}
                              </span>
                              {stage === 'Active' && (
                                <Tag tone={insights.isOnTrack ? 'green' : 'amber'}>
                                  {insights.isOnTrack
                                    ? 'On track'
                                    : insights.dailyCutNeeded > 0 ? `Save ${formatCurrency(insights.dailyCutNeeded)} more a day` : 'Behind'}
                                </Tag>
                              )}
                            </>
                          )}
                        </div>

                        {addFundsGoalId === goal.id ? (
                          <div className="mt-3 flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              aria-label={`Amount to add to ${goal.title}`}
                              placeholder="Amount"
                              value={addFundsAmount}
                              onChange={(e) => setAddFundsAmount(e.target.value)}
                              className="h-8 flex-1"
                              autoFocus
                            />
                            <Button size="sm" onClick={() => handleAddFunds(goal.id)}>Add</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setAddFundsGoalId(null); setAddFundsAmount(''); }}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="mt-3 flex items-center gap-1 border-t pt-2">
                            {stage === 'Active' && <Button size="sm" onClick={() => setAddFundsGoalId(goal.id)}>Add funds</Button>}
                            {stage === 'Paused' && <Button size="sm" variant="secondary" onClick={() => handleToggleStatus(goal)}>Resume</Button>}
                            <div className="ml-auto flex gap-0.5">
                              {stage === 'Active' && (
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleToggleStatus(goal)} aria-label={`Pause ${goal.title}`}>
                                  <PauseCircle className="h-4 w-4" />
                                </Button>
                              )}
                              {stage !== 'Completed' && (
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(goal)} aria-label={`Edit ${goal.title}`}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => handleDelete(goal.id)} aria-label={`Delete ${goal.title}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
