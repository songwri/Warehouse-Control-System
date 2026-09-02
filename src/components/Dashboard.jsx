import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { TOTAL_ORDERS } from '../hooks/useSimulation.js';

// Run telemetry. Laid out as a real grid rather than five tiles of five
// different min-widths, so the labels sit on one baseline and the numbers on
// another - the column edges are what make a strip of figures scannable.
function Tile({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col justify-center gap-1 border-r border-ink-700 px-4 ${className}`}>
      <span className="font-mono text-ui-micro uppercase tracking-[0.12em] text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function Figure({ value, unit, color = '#eef2f9' }) {
  return (
    <span className="font-mono text-ui-stat font-bold leading-none tabular-nums" style={{ color }}>
      {typeof value === 'number' ? value.toLocaleString() : value}
      {unit && <span className="ml-1 font-sans text-ui-meta font-normal text-slate-500">{unit}</span>}
    </span>
  );
}

export default function Dashboard({ sim }) {
  // Read from the throttled `dash` snapshot, not the per-frame one, so the
  // tiles and the chart settle instead of churning on every tick.
  const {
    storageCounts,
    totalAbsorbed,
    wmsGroupsFormed,
    completedCount,
    palletCompleted,
    optimizationEvents,
    leadTimeReduction,
    history,
  } = sim.dash;
  const { running } = sim;
  const inStorage = storageCounts.climber + storageCounts.shuttle + storageCounts.rack;

  // Direct labelling beats a legend: the current rate is printed next to the
  // series it belongs to, in that series' own colour, so the chart needs no key.
  const last = history[history.length - 1] || { inRate: 0, outRate: 0 };
  const peak = history.reduce((m, h) => Math.max(m, h.inRate, h.outRate), 0);

  return (
    <section className="grid h-[100px] flex-shrink-0 grid-cols-[repeat(4,minmax(140px,1fr))_2.2fr] border-t border-ink-700 bg-ink-900">
      <Tile label="입고 누적">
        <Figure value={totalAbsorbed} unit="건" />
        <span className="text-ui-meta text-slate-500">재고 {inStorage.toLocaleString()}건 보관중</span>
      </Tile>

      <Tile label="출고 완료">
        <Figure value={completedCount} unit={`/ ${TOTAL_ORDERS.toLocaleString()}`} color="#3ecf8e" />
        <span className="text-ui-meta text-slate-500">팔레트 직송 {palletCompleted.toLocaleString()}건 포함</span>
      </Tile>

      <Tile label="오더그룹 편성">
        <Figure value={wmsGroupsFormed} unit="회" color="#9a7ad4" />
        <span className="text-ui-meta text-slate-500">총량 · 오더피킹 분기 판단</span>
      </Tile>

      <Tile label="AI 최적화">
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${running ? 'pulse-ring bg-ok' : 'bg-slate-600'}`} />
          <span className="font-mono text-ui-lead font-bold" style={{ color: running ? '#3ecf8e' : '#67748f' }}>
            {running ? 'ACTIVE' : 'PAUSED'}
          </span>
        </span>
        <span className="text-ui-meta text-slate-500">
          개입 {optimizationEvents}회 · 리드타임 {leadTimeReduction}% 단축
        </span>
      </Tile>

      <div className="flex flex-col justify-center gap-1 px-4 py-2">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-ui-micro uppercase tracking-[0.12em] text-slate-500">
            처리량 추이 (건/s)
          </span>
          <span className="flex items-baseline gap-4 font-mono text-ui-meta tabular-nums">
            <span style={{ color: '#5188cf' }}>
              입고 <b className="text-ui-card">{last.inRate}</b>
            </span>
            <span style={{ color: '#3ecf8e' }}>
              출고 <b className="text-ui-card">{last.outRate}</b>
            </span>
            <span className="text-slate-600">peak {peak}</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={54}>
          <AreaChart data={history} margin={{ top: 4, right: 2, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5188cf" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#5188cf" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3ecf8e" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#3ecf8e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, (max) => Math.max(4, max + 1)]} />
            <Tooltip
              contentStyle={{ background: '#0a0f1b', border: '1px solid #232e46', borderRadius: 8, fontSize: 11 }}
              labelFormatter={() => ''}
              formatter={(v, name) => [`${v}건/s`, name === 'inRate' ? '입고' : '출고']}
            />
            <Area type="monotone" dataKey="inRate" stroke="#5188cf" strokeWidth={1.6} fill="url(#inGrad)" isAnimationActive={false} />
            <Area type="monotone" dataKey="outRate" stroke="#3ecf8e" strokeWidth={1.6} fill="url(#outGrad)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
