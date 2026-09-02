import { motion } from 'framer-motion';
import { TOTAL_ORDERS } from '../hooks/useSimulation.js';

// The order stream is a second, independent WCS decision from goods
// inbound: sales orders accumulate in WMS, and once enough pile up WCS
// groups them into a bulk (총량피킹) or discrete (오더피킹) picking run.
//
// The queue used to be drawn as wrapped chips, one per pending order. That
// reflowed: fourteen 10px chips plus gaps overran the panel's content width,
// so the row broke and the overflow counter was stranded alone on a second
// line. A queue that changes height as it fills is also the wrong shape for
// the thing it describes - this is a gauge running toward a threshold, not a
// list. So it is a fixed 24-slot bar on a grid: the slot count never changes,
// only how many are lit, and it can never wrap.
const SLOTS = 24;

export default function WmsPanel({ pendingCount, ordersSpawned, groupsFormed, threshold }) {
  const target = threshold || 1;
  const ratio = Math.min(1, pendingCount / target);
  const litSlots = Math.round(ratio * SLOTS);
  const near = ratio >= 0.8;

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-900/95 shadow-panel backdrop-blur-sm pointer-events-none">
      <header className="flex items-baseline justify-between border-b border-ink-700/80 px-3.5 py-2.5">
        <h2 className="font-display text-ui-meta font-bold uppercase tracking-[0.14em] text-slate-300">
          WMS 오더 접수
        </h2>
        <span className="font-mono text-ui-meta tabular-nums text-slate-500">
          {ordersSpawned.toLocaleString()} / {TOTAL_ORDERS.toLocaleString()}
        </span>
      </header>

      <div className="px-3.5 py-3">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-mono text-ui-stat font-bold tabular-nums transition-colors"
            style={{ color: near ? '#e5a53c' : '#eef2f9' }}
          >
            {pendingCount}
          </span>
          <span className="font-mono text-ui-meta text-slate-500">/ {target}건 편성 대기</span>
        </div>

        {/* fixed slot count: the bar fills, it never reflows */}
        <div className="mt-2 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${SLOTS}, minmax(0, 1fr))` }}>
          {Array.from({ length: SLOTS }).map((_, i) => {
            const lit = i < litSlots;
            return (
              <motion.span
                key={i}
                className="h-3.5 rounded-[2px]"
                animate={{
                  backgroundColor: lit ? (near ? '#e5a53c' : '#4f8ef7') : '#182135',
                  opacity: lit ? 1 : 0.85,
                }}
                transition={{ duration: 0.25 }}
              />
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center justify-between font-mono text-ui-micro uppercase tracking-wider text-slate-500">
          <span>{near ? '그룹 편성 임박' : '오더 누적중'}</span>
          <span className="tabular-nums">그룹 {groupsFormed}회</span>
        </div>
      </div>
    </section>
  );
}
