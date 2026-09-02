import { memo } from 'react';
import { motion } from 'framer-motion';
import { LANES, STAGES } from '../data/equipment.js';

const COL_W = 100 / STAGES.length;
const ROW_H = 100 / LANES.length;
const laneIndex = Object.fromEntries(LANES.map((l, i) => [l.key, i]));
const laneColor = Object.fromEntries(LANES.map((l) => [l.key, l.color]));

function OrderToken({ order }) {
  if (order.status === 'staging') return null;
  const li = laneIndex[order.lane];
  const left = order.stageIndex * COL_W + 3 + order.progress * (COL_W - 6);
  const jitter = ((order.id * 37) % 10) - 5; // stable per-order vertical jitter within the row
  const top = li * ROW_H + ROW_H / 2 + jitter * 0.85;
  const color = order.urgent ? '#f59e0b' : laneColor[order.lane];

  return (
    <motion.div
      className="absolute rounded-[3px]"
      style={{
        width: order.urgent ? 16 : 11,
        height: order.urgent ? 16 : 11,
        marginLeft: order.urgent ? -8 : -5.5,
        marginTop: order.urgent ? -8 : -5.5,
        background: color,
        boxShadow: `0 0 ${order.urgent ? 16 : 8}px ${order.urgent ? 4 : 1}px ${color}`,
        zIndex: order.urgent ? 30 : order.rerouted ? 20 : 10,
      }}
      animate={{ left: `${left}%`, top: `${top}%`, opacity: order.status === 'done' ? 0 : 1 }}
      transition={{ duration: 0.1, ease: 'linear' }}
      initial={false}
    />
  );
}

export default memo(OrderToken, (a, b) => {
  const o1 = a.order;
  const o2 = b.order;
  return (
    o1.stageIndex === o2.stageIndex &&
    o1.progress === o2.progress &&
    o1.lane === o2.lane &&
    o1.status === o2.status &&
    o1.rerouted === o2.rerouted
  );
});
