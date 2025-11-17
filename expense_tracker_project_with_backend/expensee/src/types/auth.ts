export interface AuthSession {
  token: string;
  user: { id: string; username: string; email: string; name: string };
}
export interface LoginCredentials { username: string; password: string; }
export interface RegisterData { username: string; email: string; password: string; name: string; }
