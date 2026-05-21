import { useMemo, useState } from 'react';
import { format, subDays, eachDayOfInterval, getDay, startOfDay } from 'date-fns';
import { formatCurrency } from '../../utils/currency';
import './SpendingHeatmap.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SpendingHeatmap({ expenses = [], heatmapData = null, days = 180, currency = 'INR' }) {
    const [tooltip, setTooltip] = useState(null);

    const { weeks, months, thresholds } = useMemo(() => {
        // ── Build daily spend map ──────────────────────────────────────────
        // The backend returns keys as UTC date strings (e.g. "2026-05-20").
        // We use local-date keys everywhere to avoid a timezone day-shift bug
        // where IST (UTC+5:30) transactions get bucketed into the wrong day.
        const dailySpend = {};

        if (heatmapData) {
            // Copy the server-provided map directly — keys are 'YYYY-MM-DD' UTC strings.
            // We treat them as local dates since they were aggregated per calendar date
            // in the DB (UTC midnight boundaries). Acceptable for display purposes.
            Object.assign(dailySpend, heatmapData);
        } else {
            expenses.forEach(e => {
                if (!e.date) return;
                // Use local-time formatting so the day matches the user's timezone
                const key = format(startOfDay(new Date(e.date)), 'yyyy-MM-dd');
                dailySpend[key] = (dailySpend[key] || 0) + (e.amount || 0);
            });
        }


        // ── Build the date range ───────────────────────────────────────────
        const endDate = startOfDay(new Date());
        const startDate = subDays(endDate, days - 1);
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });

        // Max for intensity scaling (fallback/display)
        let mx = 0;
        allDays.forEach(d => {
            const key = format(d, 'yyyy-MM-dd');
            if ((dailySpend[key] || 0) > mx) mx = dailySpend[key];
        });

        // ── Group into GitHub-style weekly columns (Sun → Sat) ─────────────
        // Each "week" is a column of 7 cells: index 0 = Sunday, 6 = Saturday.
        // We pad the start so the first cell in the grid aligns to Sunday.
        const wks = [];
        let currentWeek = new Array(7).fill(null);

        allDays.forEach(d => {
            const dow = getDay(d); // 0 = Sunday … 6 = Saturday
            const key = format(d, 'yyyy-MM-dd');

            // If this is a Sunday and the current week already has data, flush it
            if (dow === 0 && currentWeek.some(c => c !== null)) {
                wks.push(currentWeek);
                currentWeek = new Array(7).fill(null);
            }

            currentWeek[dow] = {
                date: d,
                key,
                spend: dailySpend[key] || 0,
            };
        });

        // Flush the last partial week
        if (currentWeek.some(c => c !== null)) {
            wks.push(currentWeek);
        }

        // ── Month labels ───────────────────────────────────────────────────
        const mos = [];
        let lastMonth = '';
        wks.forEach((week, wi) => {
            const firstDay = week.find(c => c !== null);
            if (firstDay) {
                const monthLabel = format(firstDay.date, 'MMM');
                if (monthLabel !== lastMonth) {
                    mos.push({ label: monthLabel, index: wi });
                    lastMonth = monthLabel;
                }
            }
        });

        // ── Percentile threshold calculation ───────────────────────────────
        // Sorting non-zero spends to split into even quartiles
        const nonZeroSpends = Object.keys(dailySpend)
            .map(key => dailySpend[key])
            .filter(spend => spend > 0)
            .sort((a, b) => a - b);

        let t1 = 0;
        let t2 = 0;
        let t3 = 0;

        if (nonZeroSpends.length > 0) {
            t1 = nonZeroSpends[Math.floor(nonZeroSpends.length * 0.25)] || 0;
            t2 = nonZeroSpends[Math.floor(nonZeroSpends.length * 0.50)] || 0;
            t3 = nonZeroSpends[Math.floor(nonZeroSpends.length * 0.75)] || 0;
        }

        return { weeks: wks, maxSpend: mx, months: mos, thresholds: { t1, t2, t3 } };
    }, [expenses, heatmapData, days]);

    function getLevel(spend) {
        if (!spend || spend === 0) return 0;
        if (spend <= thresholds.t1) return 1;
        if (spend <= thresholds.t2) return 2;
        if (spend <= thresholds.t3) return 3;
        return 4;
    }

    function handleMouseEnter(e, cell) {
        if (!cell) return;
        setTooltip({
            x: e.clientX + 12,
            y: e.clientY - 36,
            date: format(cell.date, 'MMM d, yyyy'),
            spend: cell.spend,
        });
    }

    function handleMouseLeave() {
        setTooltip(null);
    }

    return (
        <div className="heatmap-container">
            {/* Month labels row */}
            {months.length > 0 && (
                <div className="heatmap-months" style={{ paddingLeft: 32 }}>
                    {months.map((m, i) => {
                        // Calculate approximate pixel width: each week col = 17px (14 + 3 gap)
                        const nextIdx = months[i + 1]?.index ?? weeks.length;
                        const spanWeeks = nextIdx - m.index;
                        return (
                            <span
                                key={i}
                                className="heatmap-month-label"
                                style={{ minWidth: spanWeeks * 17 }}
                            >
                                {m.label}
                            </span>
                        );
                    })}
                </div>
            )}

            <div className="heatmap-grid">
                {/* Day-of-week labels (Sun–Sat) */}
                <div className="heatmap-day-labels">
                    {DAY_LABELS.map((label, i) => (
                        <span key={i} className={`heatmap-day-label ${i % 2 === 0 ? 'heatmap-day-label--hidden' : ''}`}>
                            {label}
                        </span>
                    ))}
                </div>

                {/* Weekly columns */}
                <div className="heatmap-weeks">
                    {weeks.map((week, wi) => (
                        <div key={wi} className="heatmap-week">
                            {week.map((cell, di) => (
                                <div
                                    key={di}
                                    className={`heatmap-cell level-${cell ? getLevel(cell.spend) : 'empty'}`}
                                    onMouseEnter={e => handleMouseEnter(e, cell)}
                                    onMouseLeave={handleMouseLeave}
                                />
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
                    <span className="heatmap-tooltip-date">{tooltip.date}</span>
                    {tooltip.spend > 0
                        ? <span className="heatmap-tooltip-amount">
                            {formatCurrency(Math.round(tooltip.spend), currency)}
                          </span>
                        : <span className="heatmap-tooltip-zero">No spending</span>
                    }
                </div>
            )}
        </div>
    );
}
