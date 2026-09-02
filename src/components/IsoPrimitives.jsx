import { isoPoint, depthOf, TILE_W, TILE_H } from '../lib/iso.js';

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
