import { motion } from 'framer-motion';

// Every routing call WCS makes, as live counters. Replaces the old event feed,
// which replaced its own text faster than anyone could read a single line.
//
// The rows are grouped by the stage of the process they belong to. Seven flat
// rows with seven different hues read as seven unrelated numbers; three named
// groups read as "receiving, then planning, then fulfilling", which is the
// actual story. Each group carries one hue, so the colour count drops from
// seven to three and the hue now means something.
const GROUPS = [
  {
    key: 'receive',
    label: '입하',
    color: '#3aa8bd',
    rows: [
      { key: 'inbound', label: '입고 판정' },
      { key: 'storage', label: '보관 배정' },
    ],
  },
  {
    key: 'plan',
    label: '오더 계획',
    color: '#9a7ad4',
    rows: [
      { key: 'order', label: '오더 접수' },
      { key: 'grouping', label: '그룹 편성' },
    ],
  },
  {
    key: 'fulfil',
    label: '출하 실행',
    color: '#3bab84',
    rows: [
      { key: 'picking', label: '피킹 배정' },
      { key: 'sorting', label: '소터 배분' },
      { key: 'outbound', label: '출고 배정' },
    ],
  },
];

function LedgerRow({ label, value, color }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ui-body text-slate-400">{label}</span>
      {/* remounting on each new value replays the flash, so a tick is visible
          without the number ever becoming unreadable */}
      <motion.span
        key={value}
        initial={{ color, scale: 1.18 }}
        animate={{ color: '#eef2f9', scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="font-mono text-ui-card font-bold tabular-nums"
      >
        {value.toLocaleString()}
      </motion.span>
    </div>
  );
}

export default function DecisionLedger({ counts, latestEvent }) {
  const total = GROUPS.reduce(
    (n, g) => n + g.rows.reduce((m, r) => m + (counts[r.key] || 0), 0),
    0,
  );

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-ink-700 bg-ink-900/95 shadow-panel backdrop-blur-sm pointer-events-none">
      <header className="flex items-baseline justify-between border-b border-ink-700/80 px-3.5 py-2.5">
        <h2 className="font-display text-ui-meta font-bold uppercase tracking-[0.14em] text-accent-soft">
          WCS 의사결정
        </h2>
        <span className="font-mono text-ui-card font-bold tabular-nums text-slate-100">
          {total.toLocaleString()}
          <span className="ml-0.5 text-ui-micro font-normal text-slate-500">건</span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3.5 py-3">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: g.color }} />
              <span
                className="font-mono text-ui-micro font-bold uppercase tracking-[0.12em]"
                style={{ color: g.color }}
              >
                {g.label}
              </span>
              <span className="h-px flex-1" style={{ background: `${g.color}26` }} />
            </div>
            <div className="flex flex-col gap-1.5 pl-3.5">
              {g.rows.map((r) => (
                <LedgerRow key={r.key} label={r.label} value={counts[r.key] || 0} color={g.color} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {latestEvent && (
        <footer className="border-t border-ink-700/80 px-3.5 py-2.5">
          <p className="line-clamp-2 text-ui-meta leading-snug text-slate-500">{latestEvent.text}</p>
        </footer>
      )}
    </section>
  );
}
