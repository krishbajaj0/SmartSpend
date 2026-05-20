import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppLayout from './components/layout/AppLayout';
import { GoogleOAuthProvider } from '@react-oauth/google';

/* ── Lazy-loaded page components ─────────────────────────── */
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const ReceiptsPage = lazy(() => import('./pages/ReceiptsPage'));
const BudgetsPage = lazy(() => import('./pages/BudgetsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ImportTransactions = lazy(() => import('./pages/ImportTransactions'));
const AiAnalyticsDashboard = lazy(() => import('./pages/AiAnalyticsDashboard'));

/* ── Loading spinner shown during auth restoration & lazy loads ── */
function AppSpinner() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg-primary, #0a0e1a)',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid rgba(139, 92, 246, 0.2)',
        borderTopColor: '#8b5cf6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <AppSpinner />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <AppSpinner />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

function FallbackRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <AppSpinner />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<AppSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="/goals" element={<BudgetsPage />} />
          <Route path="/import" element={<ImportTransactions />} />
          <Route path="/settings" element={<SettingsPage />} />
          
          {/* ── Hidden DEV Route ── */}
          <Route path="/analytics/ai" element={<AiAnalyticsDashboard />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<FallbackRoute />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}
