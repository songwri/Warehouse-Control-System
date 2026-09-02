import { motion } from 'framer-motion';
import { isoPoint, depthOf, TILE_W, TILE_H } from '../lib/iso.js';
import EquipIcon from './EquipIcon.jsx';

const CALLOUT_TONE = { info: '#93c5fd', ok: '#34d399', urgent: '#fbbf24' };

export function IsoTile({ col, row, color, opacity = 1, filled = false }) {
  const { x, y } = isoPoint(col, row);
  return (
    <div
      className="absolute"
      style={{
        left: x - TILE_W / 2,
        top: y,
        width: TILE_W,
        height: TILE_H,
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        background: color,
        opacity,
        border: filled ? '1px solid rgba(255,255,255,.14)' : '1px solid rgba(255,255,255,.045)',
        boxSizing: 'border-box',
        zIndex: depthOf(col, row),
      }}
    />
  );
}

export function IsoBuilding({ col, row, width = 92, elevation = 46, borderColor, glow, children, active }) {
  const { x, y } = isoPoint(col, row);
  const baseX = x;
  const baseY = y + TILE_H / 2;
  return (
    <>
      <div
        className="absolute rounded-full"
        style={{ left: baseX - 24, top: baseY - 7, width: 48, height: 13, background: 'rgba(0,0,0,.4)', filter: 'blur(3px)', zIndex: depthOf(col, row) }}
      />
      <div
        className="absolute rounded-lg border flex flex-col items-center justify-center gap-1 px-2 py-1.5 text-center transition-shadow"
        style={{
          left: baseX - width / 2,
          top: baseY - elevation,
          width,
          borderColor,
          background: 'linear-gradient(180deg, rgba(255,255,255,.09), rgba(20,26,38,.92))',
          boxShadow: active
            ? `0 0 22px -2px ${glow}, 0 10px 18px -8px rgba(0,0,0,.7)`
            : '0 10px 18px -8px rgba(0,0,0,.7)',
          zIndex: depthOf(col, row) + 1000,
        }}
      >
        {children}
      </div>
    </>
  );
}

export function IsoToken({ col, row, elevation = 20, size = 11, color, glow = false, z = 2000, shape = 'sq' }) {
  const { x, y } = isoPoint(col, row, elevation);
  return (
    <div
      className="absolute"
      style={{
        left: x - size / 2,
        top: y + TILE_H / 2 - size / 2,
        width: size,
        height: size,
        background: color,
        borderRadius: shape === 'sq' ? 2 : '50%',
        boxShadow: `0 0 ${glow ? 15 : 7}px ${glow ? 3 : 1}px ${color}, 0 ${elevation}px ${elevation / 2}px -${elevation / 2}px rgba(0,0,0,.5)`,
        zIndex: depthOf(col, row) + z,
      }}
    />
  );
}

// A moving actor rendered as its own icon chip (truck, forklift, robot
// arm) rather than a plain colored token - used for the inbound vehicle
// so its WCS-decided method (로봇암/무인지게차/일반하차) reads at a glance.
export function IsoActor({ col, row, elevation = 14, icon, color = '#e2e8f0', size = 28, pulse = false }) {
  const { x, y } = isoPoint(col, row, elevation);
  return (
    <div
      className="absolute flex items-center justify-center rounded-md transition-shadow"
      style={{
        left: x - size / 2,
        top: y + TILE_H / 2 - size / 2,
        width: size,
        height: size,
        background: 'rgba(12,17,27,.9)',
        border: `1px solid ${color}77`,
        boxShadow: pulse ? `0 0 16px 3px ${color}aa` : '0 6px 12px -6px rgba(0,0,0,.65)',
        zIndex: depthOf(col, row) + 2500,
      }}
    >
      <EquipIcon name={icon} className="w-4 h-4" style={{ color }} />
    </div>
  );
}

// A small growing/draining stack of layered bars representing units
// piled at a spot (inbound staging, storage bands) - reads as boxes or
// pallets accumulating rather than a bare number.
export function PileStack({ col, row, count, color, cap = 5, elevation = 8 }) {
  if (!count) return null;
  const layers = Math.min(cap, Math.max(1, Math.round(count / 4)));
  const { x, y } = isoPoint(col, row, elevation);
  return (
    <div
      className="absolute flex flex-col-reverse items-center pointer-events-none transition-all duration-300"
      style={{ left: x - 11, top: y + TILE_H / 2 - 6 - layers * 4, zIndex: depthOf(col, row) + 1800 }}
    >
      {Array.from({ length: layers }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 20,
            height: 6,
            marginTop: -2,
            background: color,
            opacity: 0.5 + i * 0.09,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,.25)',
          }}
        />
      ))}
      <span className="text-[8px] font-mono font-semibold text-slate-200 mt-1 drop-shadow">{count}</span>
    </div>
  );
}

// A short-lived floating "why" chip above a building - the answer to
// "what just happened here, and because of what decision".
export function Callout({ col, row, text, tone = 'info', elevation = 78 }) {
  const { x, y } = isoPoint(col, row, elevation);
  const color = CALLOUT_TONE[tone] || CALLOUT_TONE.info;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="absolute whitespace-nowrap rounded-md border px-2 py-1 text-[10.5px] font-mono font-semibold pointer-events-none"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        background: 'rgba(6,9,15,.94)',
        borderColor: `${color}80`,
        color,
        zIndex: depthOf(col, row) + 4000,
        boxShadow: `0 4px 12px -4px rgba(0,0,0,.7), 0 0 10px -4px ${color}`,
      }}
    >
      {text}
    </motion.div>
  );
}

export function IsoLabel({ col, row, elevation = 60, children, dim = false }) {
  const { x, y } = isoPoint(col, row, elevation);
  return (
    <div
      className="absolute whitespace-nowrap text-center font-mono font-semibold tracking-wide pointer-events-none"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, 0)',
        fontSize: 11,
        color: dim ? 'rgba(226,232,240,.5)' : '#e2e8f0',
        zIndex: 5000,
      }}
    >
      {children}
    </div>
  );
}
