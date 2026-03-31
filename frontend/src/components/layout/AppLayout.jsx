import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import ScrollProgress from '../ScrollProgress';
import './AppLayout.css';

export default function AppLayout() {
    const location = useLocation();
    const [showAddExpense, setShowAddExpense] = useState(false);

    return (
        <div className="app-layout">
            <ScrollProgress />
            <Sidebar />
            <div className="app-main">
                <Header onAddExpense={() => setShowAddExpense(true)} />
                <main className="app-content">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        >
                            <Outlet context={{ showAddExpense, setShowAddExpense }} />
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
            <BottomNav />
        </div>
    );
}
