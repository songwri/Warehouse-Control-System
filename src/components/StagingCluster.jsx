import { motion, AnimatePresence } from 'framer-motion';

export default function StagingCluster({ batches }) {
  // batches: array of { batchId, orders: [...staging orders] }
  const active = batches.filter((b) => b.orders.length > 0);
  if (active.length === 0) return null;

  return (
    <div className="absolute left-2 top-2 z-40 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {active.map((b) => (
          <motion.div
            key={b.batchId}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="rounded-lg border border-cyan-400/40 bg-ink-900/90 px-3 py-2 shadow-glow"
          >
            <div className="text-[10px] font-mono text-cyan-300 mb-1.5 tracking-wide">
              배치 #{b.batchId} · WCS 오더 그룹핑 중
            </div>
            <div className="grid grid-cols-5 gap-1 w-[110px]">
              {b.orders.map((o) => (
                <motion.div
                  key={o.id}
                  initial={{ x: (o.staggerX - 0.5) * 60, y: (o.staggerY - 0.5) * 60, opacity: 0 }}
                  animate={{ x: 0, y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                  className="w-3.5 h-3.5 rounded-[2px]"
                  style={{
                    background: o.lane === 'pcs' ? '#22d3ee' : o.lane === 'plt' ? '#60a5fa' : '#c084fc',
                  }}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
