export type AuthSession = {
  token: string;
  user: { id: string; username: string; email: string; name: string };
};

export const getToken = () => localStorage.getItem('auth_token');
export const clearToken = () => localStorage.removeItem('auth_token');
