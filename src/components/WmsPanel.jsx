import { AnimatePresence, motion } from 'framer-motion';
import { TOTAL_ORDERS } from '../hooks/useSimulation.js';

// The order stream is a second, independent WCS decision from goods
// inbound: sales orders accumulate in WMS, and once enough pile up WCS
// groups them into a bulk (총량피킹) or discrete (오더피킹) picking run.
export default function WmsPanel({ pendingCount, ordersSpawned, groupsFormed }) {
  const chips = Array.from({ length: Math.min(pendingCount, 14) });

  return (
    <div className="absolute right-4 top-3 z-40 w-[210px] rounded-lg border border-slate-700/70 bg-ink-900/95 backdrop-blur-sm px-3 py-2.5 pointer-events-none">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">WMS · 오더 접수</span>
        <span className="text-[10px] font-mono text-slate-400">{ordersSpawned}/{TOTAL_ORDERS}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1 min-h-[20px]">
        <AnimatePresence initial={false}>
          {chips.map((_, i) => (
            <motion.span
              key={`${groupsFormed}-${i}`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.2 }}
              className="w-2.5 h-2.5 rounded-sm bg-accent-soft/80"
            />
          ))}
        </AnimatePresence>
        {pendingCount > 14 && <span className="text-[9px] font-mono text-slate-400">+{pendingCount - 14}</span>}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9.5px] font-mono text-slate-500">
        <span>대기 {pendingCount}건</span>
        <span>그룹핑 {groupsFormed}회</span>
      </div>
    </div>
  );
}
