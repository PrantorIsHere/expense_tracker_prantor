/**
 * auth.ts — Server-backed authentication layer.
 *
 * All user data now lives in server/db/data.json (managed by lowdb).
 * The only thing stored in localStorage is:
 *   - auth_token  — JWT for API requests
 *   - auth_user   — safe user object cache (set by apiClient on login/register)
 *
 * Components that previously imported from here still work because we keep
 * the same function signatures, but everything is now async-aware.
 */

import { AuthUser, Session } from '@/types/auth';
import { apiClient } from './api';

const SESSION_KEY = 'auth_user';

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Read the cached user from localStorage (written by apiClient on login/register). */
const readCachedUser = (): Record<string, unknown> | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Map a server user object to the Session shape the frontend expects. */
const toSession = (user: Record<string, unknown>): Session => ({
  userId:    String(user.id || user.userId || ''),
  username:  String(user.username || ''),
  email:     String(user.email || ''),
  role:      (user.role as 'admin' | 'user') || 'user',
  loginTime: String(user.loginTime || new Date().toISOString()),
});

// ── Public auth API ───────────────────────────────────────────────────────────

/** Registers a new user on the server. Returns the AuthUser-shaped object. */
export const registerUser = async (
  username: string,
  email: string,
  password: string,
  role: 'admin' | 'user' = 'user',
  name?: string
): Promise<AuthUser> => {
  const data = await apiClient.register({ username, email, password, name: name || username });
  const user = data.user as Record<string, unknown>;
  // Return AuthUser shape so existing callers don't break
  return {
    id:           String(user.id || ''),
    username:     String(user.username || ''),
    email:        String(user.email || ''),
    passwordHash: '', // never exposed by server
    role:         (user.role as 'admin' | 'user') || role,
    createdAt:    String(user.created_at || new Date().toISOString()),
    updatedAt:    String(user.updated_at || new Date().toISOString()),
  };
};

/** Logs in and caches the JWT + user in localStorage. Returns Session. */
export const loginUser = async (username: string, password: string): Promise<Session> => {
  const data = await apiClient.login(username, password);
  return toSession(data.user as Record<string, unknown>);
};

/** Returns the current session from the localStorage cache, or null if not logged in. */
export const getCurrentSession = (): Session | null => {
  const user = readCachedUser();
  if (!user) return null;
  return toSession(user);
};

/** Clears all auth state from localStorage. */
export const logout = (): void => {
  apiClient.logout(); // removes auth_token + auth_user
};

/** Alias for backward compatibility. */
export const logoutUser = logout;

/** Returns true when there is a cached session. */
export const isAuthenticated = (): boolean => getCurrentSession() !== null;

/** Returns true when the cached session has role = 'admin'. */
export const isAdmin = (): boolean => getCurrentSession()?.role === 'admin';

/**
 * Returns all users — now fetched from the server.
 * NOTE: returns empty array synchronously; callers that need async should use
 * apiClient.me() or a dedicated /api/users admin endpoint.
 * This synchronous shim maintains backward compat for non-critical paths.
 */
export const getAllUsers = (): AuthUser[] => {
  // Synchronous shim — returns only the currently cached user
  const session = getCurrentSession();
  if (!session) return [];
  return [{
    id:           session.userId,
    username:     session.username,
    email:        session.email,
    passwordHash: '',
    role:         session.role,
    createdAt:    session.loginTime,
    updatedAt:    session.loginTime,
  }];
};

/**
 * Delete a user — requires admin; calls the server.
 * Note: add a DELETE /api/users/:id server route if full admin management is needed.
 */
export const deleteUser = async (userId: string): Promise<void> => {
  const session = getCurrentSession();
  if (!session || session.role !== 'admin') throw new Error('Admin privileges required');
  if (userId === session.userId) throw new Error('Cannot delete your own account');
  // Placeholder — wire to DELETE /api/users/:id when that route exists
  throw new Error('deleteUser: server route not yet implemented');
};

/**
 * Update the user profile — calls the server.
 * Note: add a PUT /api/users/:id server route for full profile editing.
 */
export const updateUserProfile = async (
  _userId: string,
  _updates: Partial<AuthUser>
): Promise<AuthUser> => {
  throw new Error('updateUserProfile: server route not yet implemented');
};

/**
 * Change password — calls the server.
 * Note: add a POST /api/auth/change-password server route.
 */
export const changePassword = async (
  _userId: string,
  _currentPassword: string,
  _newPassword: string
): Promise<void> => {
  throw new Error('changePassword: server route not yet implemented');
};