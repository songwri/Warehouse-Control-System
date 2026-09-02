import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { LANES, TOTAL_ORDERS } from '../data/equipment.js';

const CAPACITY = 26;

function StatTile({ label, value, unit, accent, sub }) {
  return (
    <div className="flex flex-col justify-center px-4 border-r border-slate-800 last:border-r-0 min-w-[128px]">
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</span>
      <span className="font-mono text-xl font-semibold leading-tight" style={{ color: accent }}>
        {value}
        {unit && <span className="text-xs text-slate-500 ml-1 font-normal">{unit}</span>}
      </span>
      {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
    </div>
  );
}

export default function Dashboard({ orders, completedCount, metrics, running }) {
  const movingByLane = useMemo(() => {
    const counts = { pcs: 0, plt: 0, manual: 0 };
    for (const o of orders) {
      if (o.status === 'moving') counts[o.lane] = (counts[o.lane] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const movingTotal = movingByLane.pcs + movingByLane.plt + movingByLane.manual;
  const utilization = Math.min(100, Math.round((movingTotal / CAPACITY) * 100));

  const chartData = metrics.throughputHistory.map((p) => ({ t: p.t, count: p.count }));

  return (
    <div className="flex items-stretch border-t border-slate-800 bg-ink-900/90 h-[104px] flex-shrink-0">
      <StatTile
        label="Throughput"
        value={completedCount}
        unit={`/ ${TOTAL_ORDERS}건`}
        accent="#e2e8f0"
        sub="완료 오더"
      />

      <div className="flex flex-col justify-center px-4 border-r border-slate-800 min-w-[150px]">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Equipment Utilization</span>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-xl font-semibold text-slate-100">{utilization}%</span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${utilization}%` }} />
          </div>
        </div>
        <div className="flex gap-2 mt-1">
          {LANES.map((l) => (
            <span key={l.key} className="text-[9px] font-mono" style={{ color: l.color }}>
              {l.key} {movingByLane[l.key]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col justify-center px-4 border-r border-slate-800 min-w-[150px]">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">AI Optimization</span>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-2 h-2 rounded-full ${running ? 'bg-ok pulse-ring' : 'bg-slate-600'}`} />
          <span className="font-mono text-sm font-semibold text-ok">{running ? 'ACTIVE' : 'PAUSED'}</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">최적화 개입 {metrics.optimizationEvents}회</span>
      </div>

      <StatTile
        label="Lead Time Reduction"
        value={`${metrics.leadTimeReduction}`}
        unit="%"
        accent="#34d399"
        sub="WCS 개입 누적 효과"
      />

      <div className="flex-1 min-w-[160px] px-3 py-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Throughput Trend</span>
        <ResponsiveContainer width="100%" height={62}>
          <AreaChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="tpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, TOTAL_ORDERS]} />
            <Tooltip
              contentStyle={{ background: '#0a0e1a', border: '1px solid #263045', fontSize: 11 }}
              labelFormatter={() => ''}
              formatter={(v) => [`${v}건`, '완료']}
            />
            <Area type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={1.75} fill="url(#tpGrad)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
