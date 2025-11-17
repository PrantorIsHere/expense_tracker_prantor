import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getUsers, saveUsers, getTransactions } from '@/lib/storage';
import { registerUser, deleteUser, getCurrentSession, isAdmin, getAllUsers } from '@/lib/auth';
import { User } from '@/types';
import { AuthUser } from '@/types/auth';
import { Users, UserPlus, Edit2, Trash2, DollarSign, Shield, ShieldCheck, Calendar } from 'lucide-react';

interface UsersTabProps {
  onDataChange: () => void;
}

export default function UsersTab({ onDataChange }: UsersTabProps) {
  const [financialUsers, setFinancialUsers] = useState<User[]>([]);
  const [accountUsers, setAccountUsers] = useState<AuthUser[]>([]);
  const [isAddFinancialDialogOpen, setIsAddFinancialDialogOpen] = useState(false);
  const [isAddAccountDialogOpen, setIsAddAccountDialogOpen] = useState(false);
  const [editingFinancialUser, setEditingFinancialUser] = useState<User | null>(null);
  const [financialFormData, setFinancialFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [accountFormData, setAccountFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user' as 'admin' | 'user'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const currentSession = getCurrentSession();
  const isAdminUser = isAdmin();

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load financial users
        const loadedFinancialUsers = getUsers();
        if (isMounted) {
          setFinancialUsers(loadedFinancialUsers);
        }
        
        // Only load account users if user is admin
        if (isAdminUser) {
          const loadedAccountUsers = getAllUsers();
          if (isMounted) {
            setAccountUsers(loadedAccountUsers);
          }
        } else {
          if (isMounted) {
            setAccountUsers([]);
          }
        }
      } catch (error) {
        console.error('Error loading users:', error);
        if (isMounted) {
          setError('Failed to load users');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isAdminUser]);

  const handleFinancialUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!financialFormData.name.trim()) {
      setError('Name is required');
      return;
    }

    const existingUsers = getUsers();
    
    if (editingFinancialUser) {
      // Update existing financial user
      const updatedUsers = existingUsers.map(user =>
        user.id === editingFinancialUser.id
          ? { ...user, ...financialFormData, updatedAt: new Date().toISOString() }
          : user
      );
      saveUsers(updatedUsers);
      setEditingFinancialUser(null);
    } else {
      // Add new financial user
      const newUser: User = {
        id: `user-${Date.now()}`,
        name: financialFormData.name,
        email: financialFormData.email,
        phone: financialFormData.phone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveUsers([...existingUsers, newUser]);
      setIsAddFinancialDialogOpen(false);
    }

    setFinancialFormData({ name: '', email: '', phone: '' });
    setFinancialUsers(getUsers());
    onDataChange();
  };

  const handleAccountUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isAdminUser) {
      setError('Admin privileges required');
      return;
    }

    if (!accountFormData.username.trim()) {
      setError('Username is required');
      return;
    }

    if (!accountFormData.email.trim()) {
      setError('Email is required');
      return;
    }

    if (!accountFormData.password.trim()) {
      setError('Password is required');
      return;
    }

    if (accountFormData.password !== accountFormData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (accountFormData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      registerUser(
        accountFormData.username,
        accountFormData.email,
        accountFormData.password,
        accountFormData.role
      );
      
      setAccountFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user'
      });
      setIsAddAccountDialogOpen(false);
      setAccountUsers(getAllUsers());
      onDataChange();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create account');
    }
  };

  const handleEditFinancialUser = (user: User) => {
    setEditingFinancialUser(user);
    setFinancialFormData({
      name: user.name,
      email: user.email || '',
      phone: user.phone || ''
    });
  };

  const handleDeleteFinancialUser = (userId: string) => {
    const transactions = getTransactions();
    const hasTransactions = transactions.some(t => t.userId === userId);
    
    if (hasTransactions) {
      setError('Cannot delete financial user with existing transactions');
      return;
    }

    const updatedUsers = financialUsers.filter(user => user.id !== userId);
    saveUsers(updatedUsers);
    setFinancialUsers(updatedUsers);
    onDataChange();
  };

  const handleDeleteAccountUser = (userId: string) => {
    if (!isAdminUser) {
      setError('Admin privileges required');
      return;
    }

    if (userId === currentSession?.userId) {
      setError('Cannot delete your own account');
      return;
    }

    if (window.confirm('Are you sure you want to delete this user account? This action cannot be undone.')) {
      try {
        deleteUser(userId);
        setAccountUsers(getAllUsers());
        onDataChange();
      } catch (error) {
        setError('Failed to delete user account');
      }
    }
  };

  const getFinancialUserTransactionCount = (userId: string): number => {
    const transactions = getTransactions();
    return transactions.filter(t => t.userId === userId).length;
  };

  const getFinancialUserTransactionTotal = (userId: string): number => {
    const transactions = getTransactions();
    return transactions
      .filter(t => t.userId === userId)
      .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
  };

  const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            User Management
          </h2>
          <p className="text-gray-600">Manage account users and financial transaction users</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="financial" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="financial">
            <DollarSign className="mr-2 h-4 w-4" />
            Financial Users
          </TabsTrigger>
          {isAdminUser && (
            <TabsTrigger value="accounts">
              <Shield className="mr-2 h-4 w-4" />
              Account Users
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="financial" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Financial Users</h3>
              <p className="text-gray-600">Manage people involved in your financial transactions</p>
            </div>
            
            <Dialog open={isAddFinancialDialogOpen} onOpenChange={setIsAddFinancialDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Financial User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Financial User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleFinancialUserSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={financialFormData.name}
                      onChange={(e) => setFinancialFormData({ ...financialFormData, name: e.target.value })}
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={financialFormData.email}
                      onChange={(e) => setFinancialFormData({ ...financialFormData, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={financialFormData.phone}
                      onChange={(e) => setFinancialFormData({ ...financialFormData, phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      Add Financial User
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAddFinancialDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Financial Users ({financialUsers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {financialUsers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Contact Info</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Net Balance</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialUsers.map((user) => {
                      const transactionCount = getFinancialUserTransactionCount(user.id);
                      const netBalance = getFinancialUserTransactionTotal(user.id);
                      
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-gray-500">ID: {user.id}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {user.email && (
                                <p className="text-sm">{user.email}</p>
                              )}
                              {user.phone && (
                                <p className="text-sm text-gray-600">{user.phone}</p>
                              )}
                              {!user.email && !user.phone && (
                                <p className="text-sm text-gray-400">No contact info</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {transactionCount} transactions
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1 ${
                              netBalance >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              <DollarSign className="h-4 w-4" />
                              <span className="font-medium">
                                {netBalance >= 0 ? '+' : ''}{netBalance.toLocaleString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditFinancialUser(user)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteFinancialUser(user.id)}
                                disabled={transactionCount > 0}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No financial users created yet</p>
                  <p className="text-sm">Add users to track transactions for different people</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Financial User Dialog */}
          <Dialog open={!!editingFinancialUser} onOpenChange={() => setEditingFinancialUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Financial User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleFinancialUserSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="editName">Name *</Label>
                  <Input
                    id="editName"
                    value={financialFormData.name}
                    onChange={(e) => setFinancialFormData({ ...financialFormData, name: e.target.value })}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="editEmail">Email</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={financialFormData.email}
                    onChange={(e) => setFinancialFormData({ ...financialFormData, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <Label htmlFor="editPhone">Phone</Label>
                  <Input
                    id="editPhone"
                    value={financialFormData.phone}
                    onChange={(e) => setFinancialFormData({ ...financialFormData, phone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Update User
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingFinancialUser(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {isAdminUser && (
          <TabsContent value="accounts" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Account Users</h3>
                <p className="text-gray-600">Manage user accounts who can log into the expense tracker</p>
              </div>
              
              <Dialog open={isAddAccountDialogOpen} onOpenChange={setIsAddAccountDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Account User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Account User</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAccountUserSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        value={accountFormData.username}
                        onChange={(e) => setAccountFormData({ ...accountFormData, username: e.target.value })}
                        placeholder="Enter username"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="accountEmail">Email *</Label>
                      <Input
                        id="accountEmail"
                        type="email"
                        value={accountFormData.email}
                        onChange={(e) => setAccountFormData({ ...accountFormData, email: e.target.value })}
                        placeholder="Enter email address"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={accountFormData.password}
                        onChange={(e) => setAccountFormData({ ...accountFormData, password: e.target.value })}
                        placeholder="Enter password (min 6 characters)"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={accountFormData.confirmPassword}
                        onChange={(e) => setAccountFormData({ ...accountFormData, confirmPassword: e.target.value })}
                        placeholder="Confirm password"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="role">Role</Label>
                      <select
                        id="role"
                        value={accountFormData.role}
                        onChange={(e) => setAccountFormData({ ...accountFormData, role: e.target.value as 'admin' | 'user' })}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="user">Normal User</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">
                        Create Account
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsAddAccountDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Account Users ({accountUsers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {accountUsers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.username}</p>
                                <p className="text-sm text-gray-500">ID: {user.id}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role === 'admin' ? (
                                <>
                                  <ShieldCheck className="mr-1 h-3 w-3" />
                                  Admin
                                </>
                              ) : (
                                <>
                                  <Shield className="mr-1 h-3 w-3" />
                                  User
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-green-600">
                              Active
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Calendar className="h-4 w-4" />
                              {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAccountUser(user.id)}
                              disabled={user.id === currentSession?.userId}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No account users found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}