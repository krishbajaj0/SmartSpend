import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Restore session on mount
    useEffect(() => {
        const savedToken = localStorage.getItem('smartexpense_token');
        if (savedToken) {
            setToken(savedToken);
            authAPI.getMe()
                .then(res => {
                    setUser(res.data.user);
                    localStorage.setItem('smartexpense_user', JSON.stringify(res.data.user));
                })
                .catch(() => {
                    localStorage.removeItem('smartexpense_token');
                    localStorage.removeItem('smartexpense_user');
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = useCallback(async (email, password) => {
        const res = await authAPI.login({ email, password });
        const { token: jwt, user: u } = res.data;
        setToken(jwt);
        setUser(u);
        localStorage.setItem('smartexpense_token', jwt);
        localStorage.setItem('smartexpense_user', JSON.stringify(u));
        return u;
    }, []);

    const register = useCallback(async (name, email, password) => {
        const res = await authAPI.register({ name, email, password });
        // Registration now sends an OTP, so we don't get a token/user yet
        return res.data;
    }, []);

    const verifyOtp = useCallback(async (email, otp) => {
        const res = await authAPI.verifyOtp({ email, otp });
        const { token: jwt, user: u } = res.data;
        setToken(jwt);
        setUser(u);
        localStorage.setItem('smartexpense_token', jwt);
        localStorage.setItem('smartexpense_user', JSON.stringify(u));
        return u;
    }, []);

    const resendOtp = useCallback(async (email) => {
        const res = await authAPI.resendOtp(email);
        return res.data;
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('smartexpense_token');
        localStorage.removeItem('smartexpense_user');
    }, []);

    const updateProfile = useCallback(async (updates) => {
        const res = await authAPI.updateProfile(updates);
        const updated = res.data.user;
        setUser(updated);
        localStorage.setItem('smartexpense_user', JSON.stringify(updated));
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
            user, token, loading, login, register, verifyOtp, resendOtp, 
            forgotPassword, resetPassword, logout, updateProfile, 
            isAuthenticated: !!token 
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
