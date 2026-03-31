import { createContext, useCallback, useContext, useState } from 'react';
import Toast from '../components/ui/Toast';

const ToastContext = createContext();

let toastId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, options = {}) => {
        const id = ++toastId;
        const toast = {
            id,
            message,
            type: options.type || 'info',
            duration: options.duration || 4000,
        };
        setToasts(prev => [...prev, toast]);
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const success = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'success' }), [addToast]);
    const error = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'error' }), [addToast]);
    const warning = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'warning' }), [addToast]);
    const info = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'info' }), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
            {children}
            <Toast toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
}
