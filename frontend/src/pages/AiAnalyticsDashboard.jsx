import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ShieldAlert, Activity, Cpu, AlertTriangle, Clock, TrendingDown, Zap } from 'lucide-react';
import api from '../utils/api';
import './AiAnalytics.css';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280', '#ec4899', '#14b8a6'];
const WINDOWS = ['24h', '7d', '30d'];
const MAX_CHART_ITEMS = 12; // Recharts dataset cap

const SEVERITY_STYLES = {
    none: { label: 'Healthy', className: 'drift-badge--none' },
    low: { label: 'Low Drift', className: 'drift-badge--low' },
    medium: { label: 'Medium Drift', className: 'drift-badge--medium' },
    critical: { label: 'Critical Drift', className: 'drift-badge--critical' },
};

export default function AiAnalyticsDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [window, setWindow] = useState('7d');

    const fetchAnalytics = useCallback(async (w) => {
        try {
            setLoading(true);
            const res = await api.get(`/ai/admin-analytics?window=${w}`);
            setData(res.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics(window);
    }, [window, fetchAnalytics]);

    const handleWindowChange = (w) => {
        setWindow(w);
    };

    if (loading) return <div className="ai-loading">Loading AI telemetry...</div>;
    if (!data) return <div className="ai-loading">Analytics disabled or unavailable.</div>;

    // Formatting for charts — cap dataset sizes
    const pieData = data.intents.slice(0, MAX_CHART_ITEMS).map(i => ({ name: i._id || 'null', value: i.count }));
    const errorData = data.errors.slice(0, MAX_CHART_ITEMS).map(e => ({ name: e._id, count: e.count }));
    const drift = data.drift || { severity: 'none', fallbackRate: '0', thresholds: {} };
    const severityInfo = SEVERITY_STYLES[drift.severity] || SEVERITY_STYLES.none;

    return (
        <div className="ai-admin-container">
            <header className="ai-admin-header">
                <Cpu size={24} className="text-accent" />
                <h1>AI Telemetry & Observability</h1>
                {/* ── Time Window Selector ── */}
                <div className="window-selector">
                    {WINDOWS.map(w => (
                        <button
                            key={w}
                            className={`window-btn ${window === w ? 'window-btn--active' : ''}`}
                            onClick={() => handleWindowChange(w)}
                        >
                            {w}
                        </button>
                    ))}
                </div>
            </header>

            {/* ── Drift Severity Banner ── */}
            {drift.severity !== 'none' && (
                <div className={`ai-alert ${drift.severity === 'critical' ? 'danger' : drift.severity === 'medium' ? 'warning' : 'info'}`}>
                    <AlertTriangle size={18} />
                    <span className={`drift-badge ${severityInfo.className}`}>{severityInfo.label}</span>
                    <span>
                        Fallback rate <strong>{drift.fallbackRate}%</strong> in {data.window} window.
                        {drift.severity === 'critical' && ' Immediate review of unknown queries recommended.'}
                        {drift.severity === 'medium' && ' Review IntentEngine patterns.'}
                        {drift.severity === 'low' && ' Monitor for escalation.'}
                    </span>
                </div>
            )}

            <div className="ai-admin-grid">
                {/* ── KPIs ── */}
                <div className="ai-admin-card stat-card">
                    <div className="stat-icon"><Activity size={20} /></div>
                    <div className="stat-label">Total Queries</div>
                    <div className="stat-value">{data.totalQueries.toLocaleString()}</div>
                    <div className="stat-window">{data.window}</div>
                </div>
                <div className="ai-admin-card stat-card">
                    <div className="stat-icon"><TrendingDown size={20} /></div>
                    <div className="stat-label">Fallback Rate</div>
                    <div className={`stat-value ${parseFloat(data.fallbackRate) > 15 ? 'text-danger' : 'text-success'}`}>
                        {data.fallbackRate}%
                    </div>
                    <div className={`drift-badge ${severityInfo.className}`}>{severityInfo.label}</div>
                </div>
                <div className="ai-admin-card stat-card">
                    <div className="stat-icon"><Zap size={20} /></div>
                    <div className="stat-label">P95 Latency</div>
                    <div className={`stat-value ${data.latency.p95 > 2000 ? 'text-danger' : ''}`}>
                        {data.latency.p95 || 0}ms
                    </div>
                </div>
                <div className="ai-admin-card stat-card">
                    <div className="stat-icon"><Clock size={20} /></div>
                    <div className="stat-label">Avg Latency</div>
                    <div className="stat-value">{data.latency.avg || 0}ms</div>
                </div>
            </div>

            <div className="ai-admin-charts">
                {/* ── Intent Distribution ── */}
                <div className="ai-admin-card">
                    <h3>Intent Distribution</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ── Handler Failures ── */}
                <div className="ai-admin-card">
                    <h3>Handler Failures</h3>
                    {errorData.length > 0 ? (
                        <div className="chart-wrapper">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={errorData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)' }} />
                                    <YAxis tick={{ fill: 'var(--text-tertiary)' }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                                    />
                                    <Bar dataKey="count" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <ShieldAlert size={48} />
                            <p>No handler failures detected.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── 24h Failure Rate Table ── */}
            {data.failureRateLast24h && data.failureRateLast24h.length > 0 && (
                <div className="ai-admin-card failure-table-card">
                    <h3>Handler Failure Rates (Last 24h)</h3>
                    <table className="failure-table">
                        <thead>
                            <tr>
                                <th>Intent</th>
                                <th>Total (24h)</th>
                                <th>Failures</th>
                                <th>Failure Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.failureRateLast24h.map((row) => (
                                <tr key={row._id}>
                                    <td className="intent-name">{row._id || 'unknown'}</td>
                                    <td>{row.total}</td>
                                    <td className={row.failures > 0 ? 'text-danger' : ''}>{row.failures}</td>
                                    <td>
                                        <span className={`failure-rate ${row.failureRate > 10 ? 'failure-rate--high' : row.failureRate > 0 ? 'failure-rate--warn' : 'failure-rate--ok'}`}>
                                            {row.failureRate}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Failure Breakdown by Intent + Error Code ── */}
            {data.failuresByIntent && data.failuresByIntent.length > 0 && (
                <div className="ai-admin-card failure-table-card">
                    <h3>Failure Breakdown (by Intent + Error Code)</h3>
                    <table className="failure-table">
                        <thead>
                            <tr>
                                <th>Intent</th>
                                <th>Error Code</th>
                                <th>Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.failuresByIntent.map((row, idx) => (
                                <tr key={idx}>
                                    <td className="intent-name">{row._id?.intent || 'unknown'}</td>
                                    <td><code className="error-code">{row._id?.errorCode}</code></td>
                                    <td className="text-danger">{row.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
