import { Link } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
    Cell
} from 'recharts';
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const COLORS = ['#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316'];

function SeverityBadge({ severity }) {
    if (!severity) return null;

    let Icon = Info;
    let label = 'Info';
    let className = 'ai-severity-info';

    if (severity === 'success') {
        Icon = CheckCircle2;
        label = 'Good';
        className = 'ai-severity-success';
    } else if (severity === 'warning') {
        Icon = AlertTriangle;
        label = 'Warning';
        className = 'ai-severity-warning';
    } else if (severity === 'danger') {
        Icon = AlertCircle;
        label = 'Action Needed';
        className = 'ai-severity-danger';
    }

    return (
        <div className={`ai-severity ${className}`}>
            <Icon size={12} />
            {label}
        </div>
    );
}

function ChatChart({ chart }) {
    if (!chart || !chart.data || chart.data.length === 0) return null;

    if (chart.chartType === 'progress') {
        const item = chart.data[0];
        const percent = Math.min(100, Math.max(0, (item.value / item.max) * 100));
        return (
            <div className="ai-chart-container">
                <div className="ai-chart-title">{chart.title}</div>
                <div className="ai-progress-bar">
                    <div
                        className="ai-progress-fill"
                        style={{ width: `${percent}%`, background: `hsl(${percent * 1.2}, 80%, 50%)` }}
                    />
                </div>
                <div className="ai-progress-label">
                    <span>{item.name}</span>
                    <span>{item.value} / {item.max}</span>
                </div>
            </div>
        );
    }

    if (chart.chartType === 'bar') {
        const { x, y } = chart.dataKeys || { x: 'name', y: 'value' };
        return (
            <div className="ai-chart-container">
                <div className="ai-chart-title">{chart.title}</div>
                <div style={{ width: '100%', height: 160 }}>
                    <ResponsiveContainer>
                        <BarChart data={chart.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis
                                dataKey={x}
                                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => `₹${val}`}
                            />
                            <RechartsTooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }}
                            />
                            <Bar dataKey={y} radius={[4, 4, 0, 0]}>
                                {chart.data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    return null;
}

export default function ResponseRenderer({ response, meta, onSuggestionClick }) {
    if (!response) return null;

    // Helper to format text with basic markdown (bold)
    const formatText = (text) => {
        if (!text) return null;
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="ai-response">
            {response.severity && <SeverityBadge severity={response.severity} />}

            <div className="ai-response-text">
                {formatText(response.text)}
            </div>

            {response.charts?.map((chart, i) => (
                <ChatChart key={i} chart={chart} />
            ))}

            {response.suggestions?.length > 0 && (
                <div className="suggestion-chips">
                    {response.suggestions.map((s, i) => (
                        <button
                            key={i}
                            className="suggestion-chip"
                            onClick={() => onSuggestionClick(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {response.actions?.length > 0 && (
                <div className="ai-actions">
                    {response.actions.map((action, i) => (
                        <Link key={i} to={action.route} className="ai-action-btn">
                            {action.label}
                        </Link>
                    ))}
                </div>
            )}
            
            {meta?.source && (
                <div className="ai-attribution" style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Info size={10} />
                    <span>Data provided by {meta.source.split('/').pop()} at {new Date(meta.generatedAt || Date.now()).toLocaleTimeString()}</span>
                </div>
            )}
        </div>
    );
}
