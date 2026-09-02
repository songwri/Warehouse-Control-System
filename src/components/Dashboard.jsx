import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { TOTAL_ORDERS } from '../hooks/useSimulation.js';
import { LANE_COLOR } from '../data/floorplan.js';

function StatTile({ label, value, unit, accent, sub }) {
  return (
    <div className="flex flex-col justify-center px-4 border-r border-slate-800 last:border-r-0 min-w-[126px]">
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</span>
      <span className="font-mono text-xl font-semibold leading-tight" style={{ color: accent }}>
        {value}
        {unit && <span className="text-xs text-slate-500 ml-1 font-normal">{unit}</span>}
      </span>
      {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
    </div>
  );
}

export default function Dashboard({ sim }) {
  const { storageCounts, totalAbsorbed, wmsPendingCount, wmsNextThreshold, wmsGroupsFormed, completedCount, palletCompleted, metrics, running } = sim;
  const inStorage = storageCounts.climber + storageCounts.shuttle + storageCounts.rack;

  return (
    <div className="flex items-stretch border-t border-slate-800 bg-ink-900/90 h-[104px] flex-shrink-0">
      <StatTile label="입고 누적" value={totalAbsorbed} unit="건" accent="#e2e8f0" sub={`재고 ${inStorage}건 보관중`} />

      <div className="flex flex-col justify-center px-4 border-r border-slate-800 min-w-[168px]">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">WMS 그룹핑 대기</span>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-xl font-semibold text-slate-100">{wmsPendingCount}</span>
          <span className="text-xs text-slate-500">/ {wmsNextThreshold}건</span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-400 to-blue-400" style={{ width: `${Math.min(100, (wmsPendingCount / wmsNextThreshold) * 100)}%` }} />
          </div>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">오더그룹 {wmsGroupsFormed}회 편성</span>
      </div>

      <StatTile
        label="출고 완료"
        value={completedCount}
        unit={`/ ${TOTAL_ORDERS}건`}
        accent="#34d399"
        sub={`+ 팔레트 직송 ${palletCompleted}건`}
      />

      <div className="flex flex-col justify-center px-4 border-r border-slate-800 min-w-[150px]">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">AI Optimization</span>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-2 h-2 rounded-full ${running ? 'bg-ok pulse-ring' : 'bg-slate-600'}`} />
          <span className="font-mono text-sm font-semibold text-ok">{running ? 'ACTIVE' : 'PAUSED'}</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">최적화 개입 {metrics.optimizationEvents}회 · 단축 {metrics.leadTimeReduction}%</span>
      </div>

      <div className="flex-1 min-w-[160px] px-3 py-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">In / Out Trend</span>
        <ResponsiveContainer width="100%" height={62}>
          <AreaChart data={metrics.history} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LANE_COLOR.plt} stopOpacity={0.5} />
                <stop offset="100%" stopColor={LANE_COLOR.plt} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, TOTAL_ORDERS]} />
            <Tooltip
              contentStyle={{ background: '#0a0e1a', border: '1px solid #263045', fontSize: 11 }}
              labelFormatter={() => ''}
              formatter={(v, name) => [`${v}건`, name === 'absorbed' ? '입고→보관' : '출고완료']}
            />
            <Area type="monotone" dataKey="absorbed" stroke={LANE_COLOR.plt} strokeWidth={1.5} fill="url(#inGrad)" isAnimationActive={false} />
            <Area type="monotone" dataKey="completed" stroke="#34d399" strokeWidth={1.5} fill="url(#outGrad)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
