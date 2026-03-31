import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import './InsightCard.css';

export default function InsightCard({ budgets, recentExpenses }) {
    const insight = useMemo(() => {
        const categoryTotals = {};
        recentExpenses?.forEach(exp => {
            const cat = exp.category || 'other';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.amount || 0);
        });
        
        const foodBudget = budgets.find(b => b.category === 'food');
        const shoppingBudget = budgets.find(b => b.category === 'shopping');
        
        const foodSpent = foodBudget?.spent || foodBudget?.currentSpent || 0;
        const shoppingSpent = shoppingBudget?.spent || shoppingBudget?.currentSpent || 0;
        const foodLimit = foodBudget?.limit || foodBudget?.limitAmount || 1;
        const shoppingLimit = shoppingBudget?.limit || shoppingBudget?.limitAmount || 1;
        
        const foodPct = (foodSpent / foodLimit) * 100;
        const shoppingPct = (shoppingSpent / shoppingLimit) * 100;
        
        const suggestions = [];
        let type = 'good';
        let text = '';
        
        if (foodPct > 100) {
            type = 'warning';
            text = `You've exceeded your Food budget by ₹${(foodSpent - foodLimit).toLocaleString()}`;
            suggestions.push('Try meal prepping to reduce food expenses');
            suggestions.push('Look for deals and discounts on groceries');
        } else if (foodPct > 80) {
            type = 'caution';
            text = `You've used ${Math.round(foodPct)}% of your Food budget`;
            suggestions.push('Consider cooking at home more often');
        } else if (shoppingPct > 80) {
            type = 'caution';
            text = `Shopping expenses are at ${Math.round(shoppingPct)}% of budget`;
            suggestions.push('Wait 24 hours before non-essential purchases');
        } else if (categoryTotals.food && categoryTotals.entertainment) {
            const foodTotal = categoryTotals.food;
            const entTotal = categoryTotals.entertainment || 0;
            if (foodTotal > entTotal * 1.5) {
                type = 'info';
                text = `You spent ${Math.round((foodTotal / (entTotal || 1)))}x more on food than entertainment`;
                suggestions.push('Consider balancing your spending on experiences');
            } else {
                text = `Great job! You're managing your spending well`;
                suggestions.push('Keep up the good financial habits!');
            }
        } else {
            text = 'Your spending looks balanced this month';
            suggestions.push('Continue tracking to maintain control');
        }
        
        return { type, text, suggestions };
    }, [budgets, recentExpenses]);

    const getIcon = () => {
        switch (insight?.type) {
            case 'warning': return '⚠️';
            case 'caution': return '📊';
            case 'info': return '💡';
            default: return '✨';
        }
    };

    return (
        <motion.div 
            className={`ai-insight-card ${insight?.type || 'good'}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            whileHover={{ scale: 1.02 }}
        >
            <div className="ai-insight-icon">
                <Lightbulb size={20} />
            </div>
            <div className="ai-insight-content">
                <span className="ai-insight-label">
                    <span className="ai-insight-emoji">{getIcon()}</span>
                    AI Insight
                </span>
                <p className="ai-insight-text">{insight?.text}</p>
                {insight?.suggestions?.length > 0 && (
                    <div className="ai-insight-suggestions">
                        {insight.suggestions.map((s, i) => (
                            <motion.div 
                                key={i} 
                                className="ai-suggestion-item"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6 + i * 0.1 }}
                            >
                                <span className="ai-suggestion-bullet">→</span>
                                <span>{s}</span>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
