import { useState, useCallback } from 'react';
import { expensesAPI, budgetsAPI, goalsAPI, receiptsAPI, analyticsAPI, aiAPI, notificationsAPI } from '../utils/api.js';

/**
 * Generic API hook with loading, error, and data state management.
 */
function useApi(apiFn) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const execute = useCallback(async (...args) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFn(...args);
            setData(res.data);
            return res.data;
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [apiFn]);

    return { data, loading, error, execute };
}

// ── Expenses ──
export function useExpenses() {
    const list = useApi(expensesAPI.list);
    const create = useApi(expensesAPI.create);
    const update = useApi((id, data) => expensesAPI.update(id, data));
    const remove = useApi(expensesAPI.delete);
    const bulkDelete = useApi(expensesAPI.bulkDelete);
    const getRecurring = useApi(expensesAPI.getRecurring);
    const duplicate = useApi(expensesAPI.duplicate);
    return { list, create, update, remove, bulkDelete, getRecurring, duplicate };
}

// ── Budgets ──
export function useBudgets() {
    const list = useApi(budgetsAPI.list);
    const createOrUpdate = useApi(budgetsAPI.createOrUpdate);
    const getStatus = useApi(budgetsAPI.getStatus);
    const remove = useApi(budgetsAPI.delete);
    return { list, createOrUpdate, getStatus, remove };
}

// ── Goals ──
export function useGoals() {
    return {
        list: useApi(goalsAPI.list),
        create: useApi(goalsAPI.create),
        update: useApi((id, data) => goalsAPI.update(id, data)),
        remove: useApi(goalsAPI.delete),
        contribute: useApi((id, data) => goalsAPI.contribute(id, data)),
        getProgress: useApi(goalsAPI.getProgress),
    };
}

// ── Receipts ──
export function useReceipts() {
    return {
        list: useApi(receiptsAPI.list),
        scan: useApi(receiptsAPI.scan),
        linkExpense: useApi((id, data) => receiptsAPI.linkExpense(id, data)),
    };
}

// ── Analytics ──
export function useAnalytics() {
    return {
        getSummary: useApi(analyticsAPI.getSummary),
        getCategoryBreakdown: useApi(analyticsAPI.getCategoryBreakdown),
        getMonthlyTrend: useApi(analyticsAPI.getMonthlyTrend),
        getComparison: useApi(analyticsAPI.getComparison),
        getWeeklyPattern: useApi(analyticsAPI.getWeeklyPattern),
        getTopMerchants: useApi(analyticsAPI.getTopMerchants),
        getHeatmap: useApi(analyticsAPI.getHeatmap),
    };
}

// ── AI ──
export function useAI() {
    return {
        getInsights: useApi(aiAPI.getInsights),
        getPredictions: useApi(aiAPI.getPredictions),
        getAnomalies: useApi(aiAPI.getAnomalies),
        getRecurringPatterns: useApi(aiAPI.getRecurringPatterns),
        getBudgetRecommendations: useApi(aiAPI.getBudgetRecommendations),
        categorize: useApi(aiAPI.categorize),
    };
}

// ── Notifications ──
export function useNotifications() {
    return {
        list: useApi(notificationsAPI.list),
        markRead: useApi(notificationsAPI.markRead),
        markAllRead: useApi(notificationsAPI.markAllRead),
    };
}
