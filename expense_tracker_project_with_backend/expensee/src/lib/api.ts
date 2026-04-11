const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type TransactionPayload = {
  voucher_id?: string;
  title: string;
  description?: string;
  amount: number;
  type: 'income' | 'expense' | 'loan_given' | 'loan_taken';
  category_id?: string | null;
  financial_user_id?: string | null;
  date: string;
};

class ApiClient {
  private token: string | null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const j: unknown = await res.json();
        if (j && typeof j === 'object' && 'error' in j && typeof j.error === 'string') {
          message = j.error;
        }
      } catch {
        message = res.statusText;
      }
      throw new Error(message);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    this.setToken(data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    return data;
  }
  async register(user: { username: string; email: string; password: string; name: string; }) {
    const data = await this.request('/auth/register', { method: 'POST', body: JSON.stringify(user) });
    this.setToken(data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    return data;
  }
  async me() {
    return this.request('/auth/me');
  }
  logout() { this.setToken(null); }

  // Transactions
  async getTransactions() { return this.request('/transactions'); }
  async createTransaction(tx: TransactionPayload) { return this.request('/transactions', { method: 'POST', body: JSON.stringify(tx) }); }
  async updateTransaction(id: string, tx: Partial<TransactionPayload>) { return this.request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(tx) }); }
  async deleteTransaction(id: string) { return this.request(`/transactions/${id}`, { method: 'DELETE' }); }

  // Categories
  async getCategories() { return this.request('/categories'); }
}

export const apiClient = new ApiClient();
