import { motion } from 'framer-motion';
import { Package, Truck, Bot, Boxes } from 'lucide-react';
import { ScrewCorners, CARBON_FIBRE_BG, SCANLINES_BG } from './Chrome.jsx';

const ROWS = [
  { icon: Truck, label: 'INBOUND · DOCK 3', value: 'ROUTING', ok: true },
  { icon: Boxes, label: 'STORAGE · RACK B-12', value: '78% FULL', ok: true },
  { icon: Bot, label: 'PICKING · AMR-04', value: 'ACTIVE', ok: true },
  { icon: Package, label: 'OUTBOUND · DOCK 6', value: 'ERROR', ok: false },
];

export default function DeviceMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, rotate: -1 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.7, ease: [0.175, 0.885, 0.32, 1.275], delay: 0.2 }}
      className="relative mx-auto w-full max-w-[420px]"
    >
      {/* outer bezel */}
      <div
        className="relative rounded-[var(--radius-xl)] p-4"
        style={{ background: '#333b44', boxShadow: 'var(--shadow-floating)', ...CARBON_FIBRE_BG, backgroundBlendMode: 'overlay' }}
      >
        <ScrewCorners inset={12} />

        {/* screen */}
        <div
          className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-lg)]"
          style={{ background: '#0c1015', boxShadow: 'var(--shadow-recessed)' }}
        >
          <div className="pointer-events-none absolute inset-0 z-20" style={SCANLINES_BG} aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/40 via-transparent to-black/20" aria-hidden="true" />

          <div className="relative z-10 flex h-full flex-col justify-between p-5">
            <div>
              <div className="flex items-center justify-between font-mono-ind text-[10px] uppercase tracking-widest text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ boxShadow: 'var(--shadow-glow-ok)' }} />
                  WCS CORE · LIVE
                </span>
                <span className="text-white/40">04.02</span>
              </div>
              <div className="mt-6 font-mono-ind text-[11px] leading-relaxed text-white/50">
                &gt; optimizing 1,204 active units_
                <br />
                &gt; lead-time reduced 18%_
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {ROWS.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <r.icon className="h-3.5 w-3.5 text-white/60" strokeWidth={1.5} />
                    <span className="font-mono-ind text-[9.5px] tracking-wide text-white/70">{r.label}</span>
                  </div>
                  <span
                    className={`font-mono-ind text-[9.5px] font-bold tracking-wide ${r.ok ? 'text-emerald-400' : 'text-[var(--accent)]'}`}
                  >
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* side buttons */}
        <div className="absolute -right-1.5 top-14 flex flex-col gap-3">
          {[28, 28].map((h, i) => (
            <span key={i} className="w-[5px] rounded-full bg-[#20252b]" style={{ height: h, boxShadow: 'var(--shadow-sharp)' }} />
          ))}
        </div>

        {/* power LED */}
        <div className="mt-3 flex items-center gap-2 px-1">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" style={{ boxShadow: 'var(--shadow-glow-accent)' }} />
          <span className="font-mono-ind text-[9px] uppercase tracking-widest text-white/40">PWR</span>
        </div>
      </div>
    </motion.div>
  );
}
