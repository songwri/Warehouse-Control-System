// Manufacturing detail primitives shared across panels: corner screws,
// vent slots, and the page-wide noise texture that simulates matte ABS.

export function ScrewCorners({ inset = 10 }) {
  const pos = [
    { left: inset, top: inset },
    { right: inset, top: inset },
    { left: inset, bottom: inset },
    { right: inset, bottom: inset },
  ];
  return (
    <>
      {pos.map((p, i) => (
        <span
          key={i}
          className="pointer-events-none absolute h-[7px] w-[7px] rounded-full"
          style={{
            ...p,
            background: 'radial-gradient(circle at 35% 35%, #8a94a3, #3d4650 75%)',
            boxShadow: '0 1px 1px rgba(255,255,255,0.6), inset 0 0 1px rgba(0,0,0,0.6)',
          }}
        />
      ))}
    </>
  );
}

export function VentSlots({ count = 3, className = '' }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="h-5 w-[3px] rounded-full bg-[var(--muted)]"
          style={{ boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.15), inset -1px -1px 1px #fff' }}
        />
      ))}
    </div>
  );
}

const NOISE_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function NoiseOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.045] mix-blend-overlay"
      style={{ backgroundImage: NOISE_SVG }}
      aria-hidden="true"
    />
  );
}

// CSS-only crosshatch approximation of woven carbon fibre - used at low
// opacity on dark technical surfaces (device bezel).
export const CARBON_FIBRE_BG = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 6px), ' +
    'repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 6px)',
};

export const SCANLINES_BG = {
  backgroundImage: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.35) 50%)',
  backgroundSize: '100% 4px',
};
