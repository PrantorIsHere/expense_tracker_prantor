import { AuthUser, Session } from '@/types/auth';

const USERS_KEY = 'expense_tracker_users';
const SESSION_KEY = 'expense_tracker_session';

// Initialize with default admin user if no users exist
const initializeDefaultUser = (): void => {
  const existingUsers = localStorage.getItem(USERS_KEY);
  if (!existingUsers) {
    const defaultAdmin: AuthUser = {
      id: 'admin-1',
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(USERS_KEY, JSON.stringify([defaultAdmin]));
  }
};

// Simple password hashing (in production, use proper hashing)
const hashPassword = (password: string): string => {
  return btoa(password + 'expense_tracker_salt');
};

const verifyPassword = (password: string, hash: string): boolean => {
  return hashPassword(password) === hash;
};

export const registerUser = (
  username: string, 
  email: string, 
  password: string, 
  role: 'admin' | 'user' = 'user'
): AuthUser => {
  initializeDefaultUser();
  
  const users = getAllUsers();
  
  // Check if username already exists
  if (users.find(u => u.username === username)) {
    throw new Error('Username already exists');
  }
  
  // Check if email already exists
  if (users.find(u => u.email === email)) {
    throw new Error('Email already exists');
  }
  
  const newUser: AuthUser = {
    id: `user-${Date.now()}`,
    username,
    email,
    passwordHash: hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const updatedUsers = [...users, newUser];
  localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
  
  return newUser;
};

export const loginUser = (username: string, password: string): Session => {
  initializeDefaultUser();
  
  const users = getAllUsers();
  const user = users.find(u => u.username === username);
  
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error('Invalid username or password');
  }
  
  const session: Session = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    loginTime: new Date().toISOString()
  };
  
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
};

export const getCurrentSession = (): Session | null => {
  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch {
    return null;
  }
};

export const logout = (): void => {
  localStorage.removeItem(SESSION_KEY);
};

// Alias for compatibility
export const logoutUser = logout;

export const getAllUsers = (): AuthUser[] => {
  try {
    initializeDefaultUser();
    const usersData = localStorage.getItem(USERS_KEY);
    return usersData ? JSON.parse(usersData) : [];
  } catch {
    return [];
  }
};

export const deleteUser = (userId: string): void => {
  const session = getCurrentSession();
  if (!session || session.role !== 'admin') {
    throw new Error('Admin privileges required');
  }
  
  if (userId === session.userId) {
    throw new Error('Cannot delete your own account');
  }
  
  const users = getAllUsers();
  const updatedUsers = users.filter(u => u.id !== userId);
  localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
};

export const isAuthenticated = (): boolean => {
  return getCurrentSession() !== null;
};

export const isAdmin = (): boolean => {
  const session = getCurrentSession();
  return session?.role === 'admin';
};

export const updateUserProfile = (userId: string, updates: Partial<AuthUser>): AuthUser => {
  const session = getCurrentSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  // Users can only update their own profile, unless they're admin
  if (session.userId !== userId && session.role !== 'admin') {
    throw new Error('Permission denied');
  }
  
  const users = getAllUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    throw new Error('User not found');
  }
  
  const updatedUser = {
    ...users[userIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  users[userIndex] = updatedUser;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  
  // Update session if user updated their own profile
  if (session.userId === userId) {
    const updatedSession = {
      ...session,
      username: updatedUser.username,
      email: updatedUser.email
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
  }
  
  return updatedUser;
};

export const changePassword = (userId: string, currentPassword: string, newPassword: string): void => {
  const session = getCurrentSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  // Users can only change their own password, unless they're admin
  if (session.userId !== userId && session.role !== 'admin') {
    throw new Error('Permission denied');
  }
  
  const users = getAllUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    throw new Error('User not found');
  }
  
  const user = users[userIndex];
  
  // Verify current password
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    throw new Error('Current password is incorrect');
  }
  
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }
  
  // Update password
  users[userIndex] = {
    ...user,
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString()
  };
  
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};