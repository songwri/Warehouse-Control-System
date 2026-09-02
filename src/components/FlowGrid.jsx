import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LANES, STAGES } from '../data/equipment.js';
import EquipIcon from './EquipIcon.jsx';
import OrderToken from './OrderToken.jsx';
import StagingCluster from './StagingCluster.jsx';

const COL_W = 100 / STAGES.length;
const ROW_H = 100 / LANES.length;

function WcsPing({ targetCol }) {
  const x = targetCol * COL_W + COL_W / 2;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" preserveAspectRatio="none">
      <motion.line
        x1="50%"
        y1="0"
        x2={`${x}%`}
        y2="100%"
        stroke="#60a5fa"
        strokeWidth="1.5"
        strokeDasharray="4 5"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0] }}
        transition={{ duration: 1.1, ease: 'easeInOut' }}
      />
    </svg>
  );
}

export default function FlowGrid({ orders, running, bottleneck, failure }) {
  const [pingCol, setPingCol] = useState(null);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setPingCol(Math.floor(Math.random() * STAGES.length));
    }, 1700);
    return () => clearInterval(iv);
  }, [running]);

  const stagingBatches = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      if (o.status !== 'staging') continue;
      if (!map.has(o.batchId)) map.set(o.batchId, []);
      map.get(o.batchId).push(o);
    }
    return Array.from(map.entries()).map(([batchId, ords]) => ({ batchId, orders: ords }));
  }, [orders]);

  const pickingCol = STAGES.findIndex((s) => s.key === 'picking');
  const outboundCol = STAGES.findIndex((s) => s.key === 'outbound');
  const pltRow = LANES.findIndex((l) => l.key === 'plt');

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {/* WCS core */}
      <div className="relative h-14 flex items-center justify-center flex-shrink-0">
        <AnimatePresence>{pingCol !== null && running && <WcsPing key={Date.now()} targetCol={pingCol} />}</AnimatePresence>
        <div className="relative flex items-center justify-center">
          <div className="absolute w-16 h-16 rounded-full border border-accent-soft/50 pulse-ring" />
          <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-accent to-blue-700 flex items-center justify-center shadow-glow z-10">
            <EquipIcon name="brain" className="w-5 h-5 text-white" />
          </div>
        </div>
        <span className="absolute right-4 text-[10px] font-mono text-slate-400 tracking-widest">WCS AI CORE</span>
      </div>

      {/* stage headers */}
      <div className="grid grid-cols-5 flex-shrink-0 mb-1.5">
        {STAGES.map((s) => (
          <div key={s.key} className="text-center">
            <div className="text-sm font-display font-semibold text-slate-100">{s.label}</div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* grid body */}
      <div className="relative flex-1 min-h-0 rounded-xl border border-slate-700/60 bg-ink-900/60 overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-5 grid-rows-3 gap-1.5 p-1.5">
          {LANES.map((lane) =>
            STAGES.map((stage) => {
              const cell = lane.cells[stage.key];
              const isBottleneckCell = bottleneck && lane.key === 'plt' && stage.key === 'picking';
              const isFailureCell = failure && lane.key === failure.lane && stage.key === 'outbound';
              return (
                <div
                  key={`${lane.key}-${stage.key}`}
                  className="relative rounded-lg border flex flex-col items-center justify-center gap-1 px-1 text-center transition-colors"
                  style={{
                    borderColor: isBottleneckCell || isFailureCell ? '#ef4444' : `${lane.color}33`,
                    background: isBottleneckCell || isFailureCell ? 'rgba(239,68,68,.12)' : 'rgba(255,255,255,.02)',
                  }}
                >
                  {isFailureCell ? (
                    <>
                      <EquipIcon name="error" className="w-5 h-5 text-slate-500 blink-fast" />
                      <span className="text-[9px] font-mono text-red-400 blink-fast tracking-wider">ERROR</span>
                    </>
                  ) : (
                    <EquipIcon name={cell.icon} className="w-5 h-5" style={{ color: lane.color }} />
                  )}
                  <span className="text-[9.5px] leading-tight text-slate-300 font-medium">{cell.name}</span>
                  {isBottleneckCell && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8.5px] font-mono font-bold text-red-400 bg-ink-950 px-1.5 rounded blink-fast">
                      BOTTLENECK
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* lane labels (left edge) */}
        <div className="absolute left-1.5 top-1.5 bottom-1.5 flex flex-col justify-around pointer-events-none">
          {LANES.map((l) => (
            <span
              key={l.key}
              className="text-[8px] font-mono font-bold tracking-widest -rotate-90 origin-left translate-y-6 opacity-60"
              style={{ color: l.color }}
            >
              {l.key.toUpperCase()}
            </span>
          ))}
        </div>

        {/* tokens overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {orders.map((o) => (
            <OrderToken key={o.id} order={o} />
          ))}
        </div>

        <StagingCluster batches={stagingBatches} />
      </div>
    </div>
  );
}
