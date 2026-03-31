import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: inject JWT ──
api.interceptors.request.use(config => {
    const token = localStorage.getItem('smartexpense_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Response interceptor: handle 401 auto-logout ──
api.interceptors.response.use(
    res => res,
    error => {
        if (error.response?.status === 401) {
            localStorage.removeItem('smartexpense_token');
            localStorage.removeItem('smartexpense_user');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ── Auth ──
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    getMe: () => api.get('/auth/me'),
    updateProfile: (data) => api.put('/auth/profile', data),
    changePassword: (data) => api.put('/auth/change-password', data),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (data) => api.post('/auth/reset-password', data),
    verifyOtp: (data) => api.post('/auth/verify-otp', data),
    resendOtp: (email) => api.post('/auth/resend-otp', { email }),
};

// ── Expenses ──
export const expensesAPI = {
    list: (params) => api.get('/expenses', { params }),
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
    exportData: (params) => api.get('/analytics/export', { params }),
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
    load: () => api.get('/dashboard'),
};

export default api;
