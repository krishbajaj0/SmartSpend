import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: inject JWT ──
function getCookie(name) {
    return document.cookie
        .split(';')
        .map(part => part.trim())
        .find(part => part.startsWith(`${name}=`))
        ?.split('=')
        .slice(1)
        .join('=') || '';
}

function createIdempotencyKey() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

api.interceptors.request.use(config => {
    config.headers['X-Request-Id'] = config.headers['X-Request-Id'] || createIdempotencyKey();
    const method = (config.method || 'get').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const csrf = decodeURIComponent(getCookie('smsp_csrf'));
        if (csrf) config.headers['X-CSRF-Token'] = csrf;
        if (!config.headers['Idempotency-Key']) {
            config.headers['Idempotency-Key'] = createIdempotencyKey();
        }
    }
    return config;
});

// ── Response interceptor: 503 retry + SPA-safe 401 handling ──
api.interceptors.response.use(
    res => res,
    async (error) => {
        const config = error.config || {};

        // ── 503 Overload: retry up to 2 times with exponential backoff ──
        if (error.response?.status === 503) {
            config._retryCount = config._retryCount || 0;
            if (config._retryCount < 2) {
                config._retryCount++;
                const delay = config._retryCount * 500;
                await new Promise(r => setTimeout(r, delay));
                return api(config);
            }
        }

        // ── 401 Unauthorized: SPA-safe soft redirect ──
        if (error.response?.status === 401) {
            // Do NOT fire auth_error for initial session check (getMe)
            // or we'll get stuck in a redirect loop on public pages like Register.
            if (config.url?.endsWith('/auth/me')) {
                return Promise.reject(error);
            }

            // Fire once per session to avoid duplicate redirects
            if (!window.__authEventFired) {
                window.__authEventFired = true;
                window.dispatchEvent(new CustomEvent('auth_error', {
                    detail: { reason: 'session_expired' }
                }));
                // Reset flag after a short delay so future expirations still work
                setTimeout(() => { window.__authEventFired = false; }, 2000);
            }
        }

        return Promise.reject(error);
    }
);

// ── Auth ──
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    loginWithGoogle: (data) => api.post('/auth/google', data),
    logout: () => api.post('/auth/logout'),
    getMe: () => api.get('/auth/me'),
    updateProfile: (data) => api.put('/auth/profile', data),
    changePassword: (data) => api.put('/auth/change-password', data),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (data) => api.post('/auth/reset-password', data),
    loadDemo: () => api.post('/auth/demo/load'),
};

// ── Expenses ──
export const expensesAPI = {
    list: (params, config = {}) => api.get('/expenses', { params, ...config }),
    get: (id) => api.get(`/expenses/${id}`),
    create: (data) => api.post('/expenses', data),
    update: (id, data) => api.put(`/expenses/${id}`, data),
    delete: (id) => api.delete(`/expenses/${id}`),
    bulkDelete: (ids) => api.post('/expenses/bulk-delete', { ids }),
    getRecurring: () => api.get('/expenses/recurring'),
    duplicate: (id) => api.post(`/expenses/duplicate/${id}`),
};

// ── Budgets ──
export const budgetsAPI = {
    list: () => api.get('/budgets'),
    createOrUpdate: (data) => api.post('/budgets', data),
    getStatus: () => api.get('/budgets/status'),
    delete: (category) => api.delete(`/budgets/${category}`),
};

// ── Goals ──
export const goalsAPI = {
    list: () => api.get('/goals'),
    get: (id) => api.get(`/goals/${id}`),
    create: (data) => api.post('/goals', data),
    update: (id, data) => api.put(`/goals/${id}`, data),
    delete: (id) => api.delete(`/goals/${id}`),
    contribute: (id, data) => api.post(`/goals/${id}/contribute`, data),
    getProgress: (id) => api.get(`/goals/${id}/progress`),
};

// ── Receipts ──
export const receiptsAPI = {
    scan: (formData) => api.post('/receipts/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    list: () => api.get('/receipts'),
    get: (id) => api.get(`/receipts/${id}`),
    fileUrl: (id) => `${API_URL}/receipts/${id}/file`,
    linkExpense: (id, data) => api.post(`/receipts/${id}/link-expense`, data),
};

// ── Analytics ──
export const analyticsAPI = {
    getSummary: () => api.get('/analytics/summary'),
    getCategoryBreakdown: () => api.get('/analytics/category-breakdown'),
    getMonthlyTrend: () => api.get('/analytics/monthly-trend'),
    getComparison: () => api.get('/analytics/comparison'),
    getWeeklyPattern: () => api.get('/analytics/weekly-pattern'),
    getTopMerchants: () => api.get('/analytics/top-merchants'),
    getHeatmap: () => api.get('/analytics/heatmap'),
    getCategoryOverTime: () => api.get('/analytics/category-over-time'),
    exportData: (params, config = {}) => api.get('/analytics/export', { params, ...config }),
};

// ── AI ──
export const aiAPI = {
    getInsights: () => api.get('/ai/insights'),
    getPredictions: () => api.get('/ai/predictions'),
    getAnomalies: () => api.get('/ai/anomalies'),
    getRecurringPatterns: () => api.get('/ai/recurring-patterns'),
    getBudgetRecommendations: () => api.get('/ai/budget-recommendations'),
    categorize: (data) => api.post('/ai/categorize', data),
    query: (query) => api.post('/ai/query', { query }),
    getSubscriptions: () => api.get('/ai/subscriptions'),
    getHealthScore: () => api.get('/ai/health-score'),
    chat: (message, conversationState = null, sessionId = null) =>
        api.post('/ai/chat', { message, conversationState, sessionId }),
    getChatHistory: (sessionId) => api.get('/ai/chat/history', { params: { sessionId } }),
};

// ── Import ──
export const importAPI = {
    preview: (formData) => api.post('/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    upload: (formData) => api.post('/import/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ── Notifications ──
export const notificationsAPI = {
    list: (params) => api.get('/notifications', { params }),
    markRead: (id) => api.put(`/notifications/${id}/read`),
    markAllRead: () => api.put('/notifications/read-all'),
};

// ── Dashboard (consolidated) ──
export const dashboardAPI = {
    load: (opts = {}) => api.get('/dashboard', opts.noCache ? { params: { _t: Date.now() } } : {}),
};

// ── Accounts ──
export const accountsAPI = {
    list: () => api.get('/accounts'),
    create: (data) => api.post('/accounts', data),
    update: (id, data) => api.put(`/accounts/${id}`, data),
    delete: (id) => api.delete(`/accounts/${id}`),
    getTransactions: (id, params) => api.get(`/accounts/${id}/transactions`, { params }),
};

// ── Transactions (Ledger) ──
export const transactionsAPI = {
    list: (params) => api.get('/transactions', { params }),
    createExpense: (data) => api.post('/transactions/expense', data),
    createIncome: (data) => api.post('/transactions/income', data),
    createTransfer: (data) => api.post('/transactions/transfer', data),
};

export default api;
