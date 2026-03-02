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
import { getGoals, saveGoals, getTransactions, formatCurrency } from '@/lib/storage';
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

  const loadData = () => {
    setGoals(getGoals());
    setTransactions(getTransactions());
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.targetAmount || !formData.deadline) {
      alert('Please fill in all required fields');
      return;
    }

    const goalData: Goal = {
      id: editingGoal?.id || `goal-${Date.now()}`,
      title: formData.title,
      description: formData.description,
      targetAmount: parseFloat(formData.targetAmount),
      currentAmount: parseFloat(formData.currentAmount || '0'),
      deadline: new Date(formData.deadline).toISOString(),
      priority: formData.priority,
      status: 'active',
      createdAt: editingGoal?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Auto-complete if current >= target
    if (goalData.currentAmount >= goalData.targetAmount) {
      goalData.status = 'completed';
    }

    const updatedGoals = editingGoal
      ? goals.map(g => (g.id === editingGoal.id ? goalData : g))
      : [goalData, ...goals];

    setGoals(updatedGoals);
    saveGoals(updatedGoals);
    onDataChange();
    setIsDialogOpen(false);
    resetForm();
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

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      const updatedGoals = goals.filter(g => g.id !== id);
      setGoals(updatedGoals);
      saveGoals(updatedGoals);
      onDataChange();
    }
  };

  const handleToggleStatus = (goal: Goal) => {
    const newStatus = goal.status === 'active' ? 'paused' : 'active';
    const updatedGoals = goals.map(g =>
      g.id === goal.id ? { ...g, status: newStatus as Goal['status'], updatedAt: new Date().toISOString() } : g
    );
    setGoals(updatedGoals);
    saveGoals(updatedGoals);
    onDataChange();
  };

  const handleAddFunds = (goalId: string) => {
    if (!addFundsAmount || parseFloat(addFundsAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(addFundsAmount);
    const updatedGoals = goals.map(g => {
      if (g.id === goalId) {
        const newCurrent = g.currentAmount + amount;
        return {
          ...g,
          currentAmount: newCurrent,
          status: newCurrent >= g.targetAmount ? 'completed' as Goal['status'] : g.status,
          updatedAt: new Date().toISOString(),
        };
      }
      return g;
    });

    setGoals(updatedGoals);
    saveGoals(updatedGoals);
    onDataChange();
    setAddFundsGoalId(null);
    setAddFundsAmount('');
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Savings Goals</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Create Goal
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
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{activeGoals.length}</div>
            <p className="text-xs text-muted-foreground">{completedGoals.length} completed, {pausedGoals.length} paused</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Saved</CardTitle>
            <PiggyBank className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSavedAmount)}</div>
            <p className="text-xs text-muted-foreground">of {formatCurrency(totalTargetAmount)} target</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{overallProgress.toFixed(1)}%</div>
            <Progress value={overallProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Savings Rate</CardTitle>
            <Wallet className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${financialInsights.dailySavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(financialInsights.dailySavings))}
            </div>
            <p className="text-xs text-muted-foreground">
              {financialInsights.dailySavings >= 0 ? 'saving' : 'overspending'} per day (avg 30d)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-blue-600" />
            Active Goals ({activeGoals.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeGoals.map(goal => {
              const insights = getGoalInsights(goal);
              return (
                <Card key={goal.id} className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Target className="h-5 w-5 text-blue-600" />
                          {goal.title}
                        </CardTitle>
                        {goal.description && (
                          <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                        )}
                      </div>
                      <Badge className={getPriorityColor(goal.priority)}>
                        {goal.priority.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{formatCurrency(goal.currentAmount)}</span>
                        <span className="text-muted-foreground">{formatCurrency(goal.targetAmount)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(insights.progress)}`}
                          style={{ width: `${insights.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 text-right">
                        {insights.progress.toFixed(1)}% complete • {formatCurrency(insights.remaining)} remaining
                      </p>
                    </div>

                    {/* Smart Insights */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold flex items-center gap-1">
                        <Zap className="h-3 w-3 text-yellow-500" />
                        Smart Savings Analysis
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className={insights.isOverdue ? 'text-red-600 font-bold' : ''}>
                            {insights.isOverdue ? 'OVERDUE' : `${insights.daysRemaining} days left`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Wallet className="h-3 w-3 text-muted-foreground" />
                          <span>{formatCurrency(insights.dailySavingsNeeded)}/day needed</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <PiggyBank className="h-3 w-3 text-muted-foreground" />
                          <span>{formatCurrency(insights.monthlySavingsNeeded)}/month needed</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {insights.daysNeededAtCurrentRate === Infinity
                              ? 'N/A (no savings)'
                              : `~${insights.daysNeededAtCurrentRate} days at current rate`
                            }
                          </span>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${insights.isOnTrack ? 'text-green-600' : 'text-orange-600'}`}>
                        {insights.isOnTrack ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            On track! Your savings rate is sufficient.
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3" />
                            {insights.dailyCutNeeded > 0
                              ? `Save ${formatCurrency(insights.dailyCutNeeded)} more/day or reduce expenses`
                              : 'Increase your savings to meet this goal'
                            }
                          </>
                        )}
                      </div>
                    </div>

                    {/* Add Funds */}
                    {addFundsGoalId === goal.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount"
                          value={addFundsAmount}
                          onChange={(e) => setAddFundsAmount(e.target.value)}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => handleAddFunds(goal.id)}>
                          Add
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setAddFundsGoalId(null); setAddFundsAmount(''); }}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => setAddFundsGoalId(goal.id)}
                        >
                          <ArrowUpRight className="h-3 w-3 mr-1" />
                          Add Funds
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleToggleStatus(goal)}>
                          <PauseCircle className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(goal)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(goal.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Paused Goals */}
      {pausedGoals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-yellow-600" />
            Paused Goals ({pausedGoals.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pausedGoals.map(goal => {
              const insights = getGoalInsights(goal);
              return (
                <Card key={goal.id} className="opacity-75 hover:opacity-100 transition-all duration-300 border-l-4 border-l-yellow-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <PauseCircle className="h-5 w-5 text-yellow-600" />
                        {goal.title}
                      </CardTitle>
                      <Badge variant="secondary">PAUSED</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{formatCurrency(goal.currentAmount)}</span>
                        <span className="text-muted-foreground">{formatCurrency(goal.targetAmount)}</span>
                      </div>
                      <Progress value={insights.progress} className="h-2" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleToggleStatus(goal)}>
                        <PlayCircle className="h-3 w-3 mr-1" />
                        Resume
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(goal)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(goal.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Completed Goals ({completedGoals.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {completedGoals.map(goal => (
              <Card key={goal.id} className="border-l-4 border-l-green-500 bg-green-50/30 dark:bg-green-900/10">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      {goal.title}
                    </CardTitle>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      COMPLETED ✓
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-green-600">{formatCurrency(goal.currentAmount)}</span>
                      <span className="text-muted-foreground">{formatCurrency(goal.targetAmount)}</span>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Completed on {new Date(goal.updatedAt).toLocaleDateString()}
                  </p>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(goal.id)}>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {goals.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No savings goals yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first savings goal to start tracking your progress
            </p>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Goal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}