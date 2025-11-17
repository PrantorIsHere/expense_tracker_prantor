import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  getTransactions, 
  saveTransactions, 
  getLoans, 
  saveLoans, 
  getUsers, 
  getCategories,
  generateVoucherId, 
  formatCurrency 
} from '@/lib/storage';
import { Transaction, Loan, User, Category } from '@/types';
import { Plus, CheckCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface LoansManagerProps {
  onDataChange: () => void;
}

export default function LoansManager({ onDataChange }: LoansManagerProps) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    userId: '',
    amount: '',
    type: 'given' as 'given' | 'taken',
    dueDate: '',
    title: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoans(getLoans());
    setTransactions(getTransactions());
    setUsers(getUsers());
    setCategories(getCategories());
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      amount: '',
      type: 'given',
      dueDate: '',
      title: '',
      description: ''
    });
  };

  const getDefaultLoanCategory = () => {
    // Try to find a loan category, otherwise use the first available category
    const loanCategory = categories.find(c => c.name.toLowerCase().includes('loan'));
    return loanCategory?.id || categories[0]?.id || 'default-category';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.userId || !formData.amount || !formData.title) {
      alert('Please fill in all required fields');
      return;
    }

    const voucherId = generateVoucherId();
    const transactionId = `loan-${Date.now()}`;
    
    // Create transaction that affects balance correctly
    const newTransaction: Transaction = {
      id: transactionId,
      voucherId,
      title: formData.title,
      description: formData.description,
      amount: parseFloat(formData.amount),
      // Fix: Loan Given = Expense (decreases balance), Loan Taken = Income (increases balance)
      type: formData.type === 'given' ? 'expense' : 'income',
      categoryId: getDefaultLoanCategory(),
      userId: formData.userId,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Create loan record
    const newLoan: Loan = {
      id: `loan-${Date.now()}`,
      transactionId,
      userId: formData.userId,
      amount: parseFloat(formData.amount),
      type: formData.type,
      status: 'pending',
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
      createdAt: new Date().toISOString()
    };

    const updatedTransactions = [newTransaction, ...transactions];
    const updatedLoans = [newLoan, ...loans];

    setTransactions(updatedTransactions);
    setLoans(updatedLoans);
    saveTransactions(updatedTransactions);
    saveLoans(updatedLoans);
    onDataChange();
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleRepayLoan = (loanId: string) => {
    if (confirm('Mark this loan as repaid? This will update your balance accordingly.')) {
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return;

      const originalTransaction = transactions.find(t => t.id === loan.transactionId);
      if (!originalTransaction) return;

      // Create repayment transaction that affects balance correctly
      const repaymentVoucherId = generateVoucherId();
      const repaymentTransactionId = `repayment-${Date.now()}`;
      
      const repaymentTransaction: Transaction = {
        id: repaymentTransactionId,
        voucherId: repaymentVoucherId,
        title: `Loan Repayment: ${originalTransaction.title}`,
        description: `Repayment of loan: ${originalTransaction.description || originalTransaction.title}`,
        amount: loan.amount,
        // Fix: Loan Given Repayment = Income (increases balance), Loan Taken Repayment = Expense (decreases balance)
        type: loan.type === 'given' ? 'income' : 'expense',
        categoryId: originalTransaction.categoryId,
        userId: loan.userId,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Update loan status
      const updatedLoans = loans.map(l => 
        l.id === loanId 
          ? { ...l, status: 'repaid' as const, repaidDate: new Date().toISOString() }
          : l
      );

      // Add repayment transaction
      const updatedTransactions = [repaymentTransaction, ...transactions];
      
      setLoans(updatedLoans);
      setTransactions(updatedTransactions);
      saveLoans(updatedLoans);
      saveTransactions(updatedTransactions);
      onDataChange();
    }
  };

  const getLoansSummary = () => {
    const pendingLoans = loans.filter(l => l.status === 'pending');
    
    const totalGiven = pendingLoans
      .filter(l => l.type === 'given')
      .reduce((sum, l) => sum + l.amount, 0);

    const totalTaken = pendingLoans
      .filter(l => l.type === 'taken')
      .reduce((sum, l) => sum + l.amount, 0);

    const netPosition = totalGiven - totalTaken;

    return { totalGiven, totalTaken, netPosition };
  };

  const getLoansWithUserInfo = () => {
    return loans.map(loan => ({
      ...loan,
      user: users.find(u => u.id === loan.userId),
      transaction: transactions.find(t => t.id === loan.transactionId)
    })).sort((a, b) => {
      // Sort by status (pending first) then by date (newest first)
      if (a.status !== b.status) {
        return a.status === 'pending' ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const summary = getLoansSummary();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Loans Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Loan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Loan</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Loan title/purpose"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount (৳) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="type">Type *</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value: 'given' | 'taken') => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="given">
                        <div className="flex flex-col">
                          <span>Loan Given</span>
                          <span className="text-xs text-muted-foreground">Money out (decreases balance)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="taken">
                        <div className="flex flex-col">
                          <span>Loan Taken</span>
                          <span className="text-xs text-muted-foreground">Money in (increases balance)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="user">User *</Label>
                <Select value={formData.userId} onValueChange={(value) => setFormData({ ...formData, userId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.length > 0 ? (
                      users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground">
                        No users available. Please add users first.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {users.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Go to Users tab to add financial users first.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={users.length === 0}>
                  Create Loan
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">How Loan Balance Works</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p><strong>Loan Given:</strong> Decreases your balance (money going out)</p>
              <p><strong>Loan Repaid:</strong> Increases your balance (money coming back)</p>
              <p><strong>Loan Taken:</strong> Increases your balance (money coming in)</p>
              <p><strong>Loan Paid Back:</strong> Decreases your balance (money going out)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Given</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalGiven)}
            </div>
            <p className="text-xs text-muted-foreground">
              Amount you lent (pending repayment)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Taken</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalTaken)}
            </div>
            <p className="text-xs text-muted-foreground">
              Amount you borrowed (pending repayment)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Position</CardTitle>
            <Badge variant={summary.netPosition >= 0 ? "default" : "destructive"}>
              {summary.netPosition >= 0 ? 'You are owed' : 'You owe'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(summary.netPosition))}
            </div>
            <p className="text-xs text-muted-foreground">
              Net outstanding amount
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Loans ({loans.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getLoansWithUserInfo().map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>
                        {new Date(loan.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{loan.transaction?.title}</p>
                          {loan.transaction?.description && (
                            <p className="text-sm text-muted-foreground">{loan.transaction.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={loan.type === 'given' ? 'default' : 'destructive'}>
                          {loan.type === 'given' ? 'GIVEN' : 'TAKEN'}
                        </Badge>
                      </TableCell>
                      <TableCell>{loan.user?.name || 'Unknown'}</TableCell>
                      <TableCell className={`font-medium ${
                        loan.type === 'given' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(loan.amount)}
                      </TableCell>
                      <TableCell>
                        {loan.dueDate ? (
                          <span className={
                            new Date(loan.dueDate) < new Date() && loan.status === 'pending'
                              ? 'text-red-600 font-medium'
                              : ''
                          }>
                            {new Date(loan.dueDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No due date</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={loan.status === 'pending' ? 'outline' : 'default'}>
                          {loan.status === 'pending' ? (
                            <>
                              <Clock className="mr-1 h-3 w-3" />
                              PENDING
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-1 h-3 w-3" />
                              REPAID
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {loan.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRepayLoan(loan.id)}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Mark Repaid
                          </Button>
                        )}
                        {loan.status === 'repaid' && loan.repaidDate && (
                          <span className="text-sm text-muted-foreground">
                            Repaid: {new Date(loan.repaidDate).toLocaleDateString()}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium">No loans found</p>
              <p className="text-sm">
                {users.length === 0 
                  ? "Add users first, then create your first loan"
                  : "Create your first loan to get started"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}