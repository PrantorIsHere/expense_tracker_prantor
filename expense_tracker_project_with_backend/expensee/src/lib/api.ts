const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ── Payload types ─────────────────────────────────────────────────────────────

type TransactionPayload = {
  voucher_id?: string;
  title: string;
  description?: string;
  amount: number;
  type: 'income' | 'expense' | 'loan_given' | 'loan_taken';
  category_id?: string | null;
  financial_user_id?: string | null;
  account_id?: string | null;
  date: string;
};

type LoanPayload = {
  person: string;
  amount: number;
  type: 'given' | 'taken';
  description?: string | null;
  date: string;
  due_date?: string | null;
  status?: 'pending' | 'paid' | 'partial';
  account_id?: string | null;
  record_transaction?: boolean;
  financial_user_id?: string | null;
};

type GoalPayload = {
  name: string;
  target_amount: number;
  current_amount?: number;
  description?: string | null;
  deadline?: string | null;
  color?: string;
  icon?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'active' | 'completed' | 'paused';
};

type CategoryPayload = {
  name: string;
  color?: string;
  icon?: string;
};

type AccountPayload = {
  name: string;
  type?: 'cash' | 'bank' | 'mobile_wallet' | 'credit_card' | 'savings' | 'other';
  account_number?: string | null;
  initial_balance?: number;
  color?: string;
  icon?: string;
};

type FinancialUserPayload = {
  name: string;
  email?: string | null;
  phone?: string | null;
  type?: string;
  notes?: string | null;
};

type SettingsPayload = {
  currency?: string;
  dateFormat?: string;
  theme?: string;
  notifications?: boolean;
  autoBackup?: boolean;
};

type TransactionHistoryItem = { id?: string; name: string; amount?: number };
type RentHistoryItem = { id?: string; month: string; amount: number; date: string; deedNote?: string };
type GadgetWarrantyItem = {
  id?: string;
  productId?: string;
  serialNumber?: string;
  name: string;
  purchaseDate: string;
  warrantyMonths?: number;
  note?: string;
};

// ── API Client ────────────────────────────────────────────────────────────────

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

  private async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
        if (j && typeof j === 'object' && 'error' in j && typeof (j as { error: string }).error === 'string') {
          message = (j as { error: string }).error;
        }
      } catch {
        message = res.statusText;
      }
      throw new Error(message);
    }
    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login(username: string, password: string) {
    const data = await this.request<{ token: string; user: Record<string, unknown> }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    return data;
  }

  async register(user: { username: string; email: string; password: string; name: string }) {
    const data = await this.request<{ token: string; user: Record<string, unknown> }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(user),
    });
    this.setToken(data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    return data;
  }

  async me() {
    return this.request('/auth/me');
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('auth_user');
  }

  // ── Transactions ──────────────────────────────────────────────────────────

  async getTransactions() { return this.request('/transactions'); }
  async createTransaction(tx: TransactionPayload) {
    return this.request('/transactions', { method: 'POST', body: JSON.stringify(tx) });
  }
  async updateTransaction(id: string, tx: Partial<TransactionPayload>) {
    return this.request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(tx) });
  }
  async deleteTransaction(id: string) {
    return this.request(`/transactions/${id}`, { method: 'DELETE' });
  }

  // ── Categories ────────────────────────────────────────────────────────────

  async getCategories() { return this.request('/categories'); }
  async createCategory(cat: CategoryPayload) {
    return this.request('/categories', { method: 'POST', body: JSON.stringify(cat) });
  }
  async updateCategory(id: string, cat: Partial<CategoryPayload>) {
    return this.request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(cat) });
  }
  async deleteCategory(id: string) {
    return this.request(`/categories/${id}`, { method: 'DELETE' });
  }

  // ── Accounts ──────────────────────────────────────────────────────────────

  async getAccounts() { return this.request('/accounts'); }
  async createAccount(acc: AccountPayload) {
    return this.request('/accounts', { method: 'POST', body: JSON.stringify(acc) });
  }
  async updateAccount(id: string, acc: Partial<AccountPayload>) {
    return this.request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(acc) });
  }
  async deleteAccount(id: string) {
    return this.request(`/accounts/${id}`, { method: 'DELETE' });
  }

  // ── Loans ─────────────────────────────────────────────────────────────────

  async getLoans() { return this.request('/loans'); }
  async createLoan(loan: LoanPayload) {
    return this.request('/loans', { method: 'POST', body: JSON.stringify(loan) });
  }
  async updateLoan(id: string, loan: Partial<LoanPayload>) {
    return this.request(`/loans/${id}`, { method: 'PUT', body: JSON.stringify(loan) });
  }
  async repayLoan(id: string, payload: { account_id: string; amount?: number; date?: string; notes?: string }) {
    return this.request(`/loans/${id}/repay`, { method: 'POST', body: JSON.stringify(payload) });
  }
  async deleteLoan(id: string) {
    return this.request(`/loans/${id}`, { method: 'DELETE' });
  }

  // ── Goals ─────────────────────────────────────────────────────────────────

  async getGoals() { return this.request('/goals'); }
  async createGoal(goal: GoalPayload) {
    return this.request('/goals', { method: 'POST', body: JSON.stringify(goal) });
  }
  async updateGoal(id: string, goal: Partial<GoalPayload>) {
    return this.request(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(goal) });
  }
  async deleteGoal(id: string) {
    return this.request(`/goals/${id}`, { method: 'DELETE' });
  }

  // ── Financial Users (Contacts) ────────────────────────────────────────────

  async getFinancialUsers() { return this.request('/financial-users'); }
  async createFinancialUser(fu: FinancialUserPayload) {
    return this.request('/financial-users', { method: 'POST', body: JSON.stringify(fu) });
  }
  async updateFinancialUser(id: string, fu: Partial<FinancialUserPayload>) {
    return this.request(`/financial-users/${id}`, { method: 'PUT', body: JSON.stringify(fu) });
  }
  async deleteFinancialUser(id: string) {
    return this.request(`/financial-users/${id}`, { method: 'DELETE' });
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSettings() { return this.request('/settings'); }
  async updateSettings(settings: SettingsPayload) {
    return this.request('/settings', { method: 'PUT', body: JSON.stringify(settings) });
  }
  async importData(data: unknown) {
    return this.request('/settings/import', { method: 'POST', body: JSON.stringify(data) });
  }

  // ── Additional Info — Transaction History ─────────────────────────────────

  async getAdditionalInfoTransactions() { return this.request('/additional-info/transactions'); }
  async saveAdditionalInfoTransactions(items: TransactionHistoryItem[]) {
    return this.request('/additional-info/transactions', { method: 'POST', body: JSON.stringify({ items }) });
  }

  // ── Additional Info — Rent History ────────────────────────────────────────

  async getRentHistory() { return this.request('/additional-info/rent'); }
  async saveRentHistory(items: RentHistoryItem[]) {
    return this.request('/additional-info/rent', { method: 'POST', body: JSON.stringify({ items }) });
  }

  // ── Additional Info — Gadget Warranties ───────────────────────────────────

  async getGadgetWarranties() { return this.request('/additional-info/gadgets'); }
  async saveGadgetWarranties(items: GadgetWarrantyItem[]) {
    return this.request('/additional-info/gadgets', { method: 'POST', body: JSON.stringify({ items }) });
  }

  // ── Vouchers ──────────────────────────────────────────────────────────────

  /** Returns the next voucher ID string for today (server-side counter). */
  async nextVoucherId(): Promise<string> {
    const data = await this.request<{ voucher_id: string }>('/vouchers/next', { method: 'POST' });
    return data.voucher_id;
  }
}

export const apiClient = new ApiClient();
