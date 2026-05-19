import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { authAPI } from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Helper to initialize socket
    const initSocket = useCallback(() => {
        const socketUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : window.location.origin;
        const newSocket = io(socketUrl, {
            withCredentials: true,
        });
        newSocket.on('session_revoked', () => {
            setUser(null);
            setSocket(null);
            navigate('/login', { replace: true, state: { message: 'Session expired' } });
        });
        setSocket(newSocket);
        return newSocket;
    }, [navigate]);

    // Restore session on mount
    useEffect(() => {
        authAPI.getMe()
            .then(res => {
                setUser(res.data.user);
                initSocket();
            })
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, [initSocket]);

    const login = useCallback(async (email, password) => {
        const res = await authAPI.login({ email, password });
        const { user: u } = res.data;
        setUser(u);
        initSocket();
        return u;
    }, [initSocket]);

    const register = useCallback(async (name, email, password) => {
        const res = await authAPI.register({ name, email, password });
        const { user: u } = res.data;
        if (u) {
            setUser(u);
            initSocket();
        }
        return res.data;

    }, [initSocket]);

    const verifyOtp = useCallback(async (email, otp) => {
        const res = await authAPI.verifyOtp({ email, otp });
        const { user: u } = res.data;
        setUser(u);
        initSocket();
        return u;
    }, [initSocket]);

    const resendOtp = useCallback(async (email) => {
        const res = await authAPI.resendOtp(email);
        return res.data;
    }, []);

    const requestLoginOtp = useCallback(async (email) => {
        const res = await authAPI.requestLoginOtp(email);
        return res.data;
    }, []);

    const loginWithOtp = useCallback(async (email, otp) => {
        const res = await authAPI.verifyLoginOtp({ email, otp });
        const { user: u } = res.data;
        setUser(u);
        initSocket();
        return u;
    }, [initSocket]);

    const logoutLocal = useCallback(() => {
        setUser(null);
        if (socket) {
            socket.disconnect();
            setSocket(null);
        }
    }, [socket]);

    const logout = useCallback(async () => {
        try {
            await authAPI.logout();
        } catch {
            // Local cleanup still happens if the session is already expired.
        } finally {
            logoutLocal();
        }
    }, [logoutLocal]);

    // ── Listen for SPA-safe 401 auth_error events from api.js ──
    useEffect(() => {
        const handler = () => {
            logoutLocal();
            navigate('/login', {
                replace: true,
                state: { message: 'Session expired', from: location.pathname }
            });
        };
        window.addEventListener('auth_error', handler);
        return () => window.removeEventListener('auth_error', handler);
    }, [logoutLocal, navigate, location.pathname]);

    const updateProfile = useCallback(async (updates) => {
        const res = await authAPI.updateProfile(updates);
        const updated = res.data.user;
        setUser(updated);
        return updated;
    }, []);

    const forgotPassword = useCallback(async (email) => {
        const res = await authAPI.forgotPassword(email);
        return res.data;
    }, []);

    const resetPassword = useCallback(async (email, otp, newPassword) => {
        const res = await authAPI.resetPassword({ email, otp, newPassword });
        return res.data;
    }, []);

    return (
        <AuthContext.Provider value={{ 
            user, loading, login, register, verifyOtp, resendOtp, 
            requestLoginOtp, loginWithOtp, socket,
            forgotPassword, resetPassword, logout, updateProfile, 
            isAuthenticated: !!user 
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
