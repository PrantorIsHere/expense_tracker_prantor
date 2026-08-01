import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { getUsers, formatCurrency } from '@/lib/storage';
import { User } from '@/components/types';
import { Plus, CheckCircle, Clock, TrendingUp, TrendingDown, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface LoansManagerProps {
  onDataChange: () => void;
}

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
  status: 'pending' | 'paid' | 'partial';
  created_at: string;
  updated_at: string;
}

export default function LoansManager({ onDataChange }: LoansManagerProps) {
  const [loans, setLoans] = useState<ServerLoan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStatus]);

  const loadData = async () => {
    try {
      const [rawLoans, usrs] = await Promise.all([
        apiClient.getLoans(),
        getUsers(),
      ]);
      setLoans(rawLoans as ServerLoan[]);
      setUsers(usrs as User[]);
    } catch (e) {
      console.error('LoansManager loadData error', e);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.userId || !formData.amount || !formData.title) {
      alert('Please fill in all required fields');
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
        person:      selectedUser.name,
        amount:      parseFloat(formData.amount),
        type:        formData.type,
        description: formData.description || formData.title,
        date:        new Date().toISOString(),
        due_date:    formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        status:      'pending',
      });

      await loadData();
      onDataChange();
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      alert(`Failed to create loan: ${(err as Error).message}`);
    }
  };

  const handleRepayLoan = async (loanId: string) => {
    if (confirm('Mark this loan as repaid?')) {
      try {
        await apiClient.updateLoan(loanId, { status: 'paid' });
        await loadData();
        onDataChange();
      } catch (err) {
        alert(`Failed to update loan: ${(err as Error).message}`);
      }
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

  const filteredLoans = loans.filter((loan) => {
    const searchValue = searchTerm.toLowerCase();
    const person = loan.person?.toLowerCase() || '';
    const description = loan.description?.toLowerCase() || '';

    const matchesSearch =
      !searchValue ||
      person.includes(searchValue) ||
      description.includes(searchValue);

    const matchesType = filterType === 'all' || loan.type === filterType;
    // server status: 'pending' | 'paid' | 'partial'; UI filter also uses 'repaid' as alias for 'paid'
    const matchesStatus =
      filterStatus === 'all' ||
      loan.status === filterStatus ||
      (filterStatus === 'repaid' && loan.status === 'paid');

    return matchesSearch && matchesType && matchesStatus;
  }).sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'pending' ? -1 : 1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLoans = filteredLoans.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pageNumbers: number[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i += 1) {
        pageNumbers.push(i);
      }
      return pageNumbers;
    }

    let startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i += 1) {
      pageNumbers.push(i);
    }

    return pageNumbers;
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
                <Label htmlFor="loanTitle">Title / Purpose *</Label>
                <Input
                  id="loanTitle"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Loan title/purpose"
                  required
                />
              </div>

              <div>
                <Label htmlFor="loanDescription">Description</Label>
                <Input
                  id="loanDescription"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="loanAmount">Amount (৳) *</Label>
                  <Input
                    id="loanAmount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="loanType">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'given' | 'taken') => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="loanType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="given">
                        <div className="flex flex-col">
                          <span>Loan Given</span>
                          <span className="text-xs text-muted-foreground">Money you lent out</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="taken">
                        <div className="flex flex-col">
                          <span>Loan Taken</span>
                          <span className="text-xs text-muted-foreground">Money you borrowed</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="loanUser">Contact Person *</Label>
                <Select value={formData.userId} onValueChange={(value) => setFormData({ ...formData, userId: value })}>
                  <SelectTrigger id="loanUser">
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
                <Label htmlFor="loanDueDate">Due Date (Optional)</Label>
                <Input
                  id="loanDueDate"
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
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">How Loans Work</h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p><strong>Loan Given:</strong> Money you lent to someone else (pending repayment)</p>
              <p><strong>Loan Taken:</strong> Money you borrowed from someone (you owe this)</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-4 w-4" />
            Loan Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="loan-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="loan-search"
                  placeholder="Person name or note"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="loan-type-filter">Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger id="loan-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="given">Loan Given</SelectItem>
                  <SelectItem value="taken">Loan Taken</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="loan-status-filter">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="loan-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Repaid / Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            All Loans ({filteredLoans.length})
            {filteredLoans.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredLoans.length)} of {filteredLoans.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentLoans.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Person</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>
                          {new Date(loan.date || loan.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{loan.person}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground">{loan.description || '—'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={loan.type === 'given' ? 'default' : 'destructive'}>
                            {loan.type === 'given' ? 'GIVEN' : 'TAKEN'}
                          </Badge>
                        </TableCell>
                        <TableCell className={`font-medium ${
                          loan.type === 'given' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(loan.amount)}
                        </TableCell>
                        <TableCell>
                          {loan.due_date ? (
                            <span className={
                              new Date(loan.due_date) < new Date() && loan.status === 'pending'
                                ? 'text-red-600 font-medium'
                                : ''
                            }>
                              {new Date(loan.due_date).toLocaleDateString()}
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
                                {loan.status.toUpperCase()}
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
                          {loan.status !== 'pending' && (
                            <span className="text-sm text-muted-foreground">
                              {loan.status === 'paid' ? 'Paid' : loan.status}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>

                    <div className="flex items-center space-x-1">
                      {getPageNumbers().map((pageNum) => (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium">No loans found</p>
              <p className="text-sm">
                {users.length === 0
                  ? "Add users first, then create your first loan"
                  : loans.length > 0
                  ? "No loans match your current filters"
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
