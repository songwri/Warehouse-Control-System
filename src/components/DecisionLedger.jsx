import { motion } from 'framer-motion';

// Every routing call WCS makes, as live counters. Replaces the old event feed,
// which replaced its own text faster than anyone could read a single line.
const ROWS = [
  { key: 'inbound', label: '입고 판정', color: '#22d3ee' },
  { key: 'storage', label: '보관 배정', color: '#60a5fa' },
  { key: 'order', label: '오더 접수', color: '#a5b4fc' },
  { key: 'grouping', label: '그룹 편성', color: '#c084fc' },
  { key: 'picking', label: '피킹 배정', color: '#34d399' },
  { key: 'sorting', label: '소터 배분', color: '#e879f9' },
  { key: 'outbound', label: '출고 배정', color: '#f59e0b' },
];

function LedgerRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-[11.5px] text-slate-300">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      {/* remounting on each new value replays the flash, so a tick is visible
          without the number ever becoming unreadable */}
      <motion.span
        key={value}
        initial={{ color, scale: 1.22 }}
        animate={{ color: '#f8fafc', scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="font-mono text-[15px] font-bold tabular-nums"
      >
        {value.toLocaleString()}
      </motion.span>
    </div>
  );
}

export default function DecisionLedger({ counts, latestEvent }) {
  const total = ROWS.reduce((n, r) => n + (counts[r.key] || 0), 0);

  return (
    <div className="absolute right-4 top-[104px] z-40 w-[248px] rounded-lg border border-slate-700/70 bg-ink-900/95 px-3.5 py-3 backdrop-blur-sm pointer-events-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="font-display text-[11px] font-bold uppercase tracking-wider text-accent-soft">
          WCS 의사결정
        </span>
        <span className="font-mono text-[11px] font-bold tabular-nums text-slate-200">
          {total.toLocaleString()}건
        </span>
      </div>

      <div className="mt-2.5 flex flex-col gap-2">
        {ROWS.map((r) => (
          <LedgerRow key={r.key} label={r.label} value={counts[r.key] || 0} color={r.color} />
        ))}
      </div>

      {latestEvent && (
        <div className="mt-3 border-t border-slate-800 pt-2">
          <p className="text-[11px] leading-snug text-slate-400 line-clamp-2">{latestEvent.text}</p>
        </div>
      )}
    </div>
  );
}
