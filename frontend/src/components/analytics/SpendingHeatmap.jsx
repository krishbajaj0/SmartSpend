import { useMemo, useState } from 'react';
import { format, subDays, startOfWeek, eachDayOfInterval, getDay } from 'date-fns';
import './SpendingHeatmap.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SpendingHeatmap({ expenses = [], days = 180 }) {
    const [tooltip, setTooltip] = useState(null);

    const { weeks, months, maxSpend } = useMemo(() => {
        // Build daily spend map
        const dailySpend = {};
        expenses.forEach(e => {
            if (!e.date) return;
            const key = format(new Date(e.date), 'yyyy-MM-dd');
            dailySpend[key] = (dailySpend[key] || 0) + (e.amount || 0);
        });

        const endDate = new Date();
        const startDate = subDays(endDate, days);
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });

        // Find max for intensity scaling
        let mx = 0;
        allDays.forEach(d => {
            const key = format(d, 'yyyy-MM-dd');
            mx = Math.max(mx, dailySpend[key] || 0);
        });

        // Group into weeks
        const wks = [];
        let currentWeek = [];
        const weekStart = startOfWeek(startDate, { weekStartsOn: 0 });

        // Pad start
        const padDays = getDay(startDate);
        for (let i = 0; i < padDays; i++) {
            currentWeek.push(null);
        }

        allDays.forEach(d => {
            const dow = getDay(d);
            if (dow === 0 && currentWeek.length > 0) {
                wks.push(currentWeek);
                currentWeek = [];
            }
            const key = format(d, 'yyyy-MM-dd');
            currentWeek.push({
                date: d,
                key,
                spend: dailySpend[key] || 0,
            });
        });
        if (currentWeek.length > 0) wks.push(currentWeek);

        // Group months for labels
        const mos = [];
        let lastMonth = '';
        wks.forEach((week, wi) => {
            const firstDay = week.find(d => d !== null);
            if (firstDay) {
                const monthLabel = format(firstDay.date, 'MMM');
                if (monthLabel !== lastMonth) {
                    mos.push({ label: monthLabel, index: wi });
                    lastMonth = monthLabel;
                }
            }
        });

        return { weeks: wks, months: mos, maxSpend: mx };
    }, [expenses, days]);

    function getLevel(spend) {
        if (spend === 0) return 0;
        if (maxSpend === 0) return 0;
        const ratio = spend / maxSpend;
        if (ratio < 0.25) return 1;
        if (ratio < 0.5) return 2;
        if (ratio < 0.75) return 3;
        return 4;
    }

    function handleMouseEnter(e, cell) {
        if (!cell) return;
        setTooltip({
            x: e.clientX + 10,
            y: e.clientY - 30,
            text: `${format(cell.date, 'MMM d, yyyy')} — ₹${Math.round(cell.spend).toLocaleString('en-IN')}`,
        });
    }

    function handleMouseLeave() {
        setTooltip(null);
    }

    return (
        <div className="heatmap-container">
            <div className="heatmap-grid">
                {/* Day labels */}
                <div className="heatmap-day-labels">
                    {DAY_LABELS.map((label, i) => (
                        <span key={i} className="heatmap-day-label">{label}</span>
                    ))}
                </div>

                {/* Weeks */}
                <div className="heatmap-weeks">
                    {weeks.map((week, wi) => (
                        <div key={wi} className="heatmap-week">
                            {week.map((cell, di) => (
                                <div
                                    key={di}
                                    className={`heatmap-cell level-${cell ? getLevel(cell.spend) : 0}`}
                                    onMouseEnter={e => handleMouseEnter(e, cell)}
                                    onMouseLeave={handleMouseLeave}
                                />
                            ))}
                            {/* Pad end of week */}
                            {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
                                <div key={`pad-${i}`} className="heatmap-cell level-0" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="heatmap-legend">
                <span>Less</span>
                <div className="heatmap-legend-cells">
                    {[0, 1, 2, 3, 4].map(l => (
                        <div key={l} className={`heatmap-cell level-${l}`} />
                    ))}
                </div>
                <span>More</span>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="heatmap-tooltip"
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    {tooltip.text}
                </div>
            )}
        </div>
    );
}
