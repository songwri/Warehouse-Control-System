import { useState } from 'react';
import { motion } from 'framer-motion';
import { ScrewCorners, VentSlots, CARBON_FIBRE_BG, SCANLINES_BG } from './Chrome.jsx';

const VIDEO_SRC = `${import.meta.env.BASE_URL}wcs-demo.mp4`;

// The hero's signature object: a rugged landscape control monitor with the
// actual simulator running on its screen. A placeholder layer sits behind the
// video so the panel still reads as a real device before the clip is ready -
// or if the browser refuses the file entirely.
export default function DeviceMockup() {
  const [playing, setPlaying] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, rotate: -1 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.7, ease: [0.175, 0.885, 0.32, 1.275], delay: 0.2 }}
      className="relative mx-auto w-full max-w-[620px]"
    >
      {/* chassis */}
      <div
        className="relative rounded-[var(--radius-xl)] p-3.5"
        style={{ background: '#333b44', boxShadow: 'var(--shadow-floating)', ...CARBON_FIBRE_BG, backgroundBlendMode: 'overlay' }}
      >
        <ScrewCorners inset={11} />

        {/* recessed screen */}
        <div
          className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-lg)]"
          style={{ background: '#080b10', boxShadow: 'var(--shadow-recessed)' }}
        >
          {/* fallback layer - visible until the clip plays */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-700"
            style={{
              opacity: playing ? 0 : 1,
              backgroundImage:
                'radial-gradient(120% 90% at 50% 0%, rgba(96,165,250,.18), transparent 60%),' +
                'repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, transparent 1px 34px),' +
                'repeating-linear-gradient(90deg, rgba(255,255,255,.045) 0 1px, transparent 1px 34px)',
            }}
            aria-hidden="true"
          >
            <span className="font-mono-ind text-[11px] uppercase tracking-[0.3em] text-white/35">
              WCS Simulation Feed
            </span>
          </div>

          <video
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            style={{ opacity: playing ? 1 : 0 }}
            src={VIDEO_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onPlaying={() => setPlaying(true)}
            aria-label="WCS 시뮬레이터 데모 영상"
          />

          {/* CRT treatment + vignette, over the footage */}
          <div className="pointer-events-none absolute inset-0 z-20 opacity-70" style={SCANLINES_BG} aria-hidden="true" />
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{ boxShadow: 'inset 0 0 90px rgba(0,0,0,.75)' }}
            aria-hidden="true"
          />

          {/* on-screen HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-3">
            <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 font-mono-ind text-[10px] uppercase tracking-widest text-emerald-400 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ boxShadow: 'var(--shadow-glow-ok)' }} />
              WCS Core · Live
            </span>
            <span className="rounded-full bg-black/55 px-2.5 py-1 font-mono-ind text-[10px] tracking-widest text-white/55 backdrop-blur-sm">
              04.02
            </span>
          </div>
        </div>

        {/* chassis footer: vents, power lamp, model plate */}
        <div className="mt-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" style={{ boxShadow: 'var(--shadow-glow-accent)' }} />
            <span className="font-mono-ind text-[9px] uppercase tracking-widest text-white/45">PWR</span>
          </div>
          <span className="font-mono-ind text-[9px] uppercase tracking-[0.24em] text-white/30">WCS-CTRL / 04</span>
          <VentSlots count={5} />
        </div>
      </div>

      {/* monitor stand */}
      <div className="mx-auto h-5 w-24 rounded-b-md" style={{ background: '#2b323a', boxShadow: 'var(--shadow-sharp)' }} />
      <div className="mx-auto h-2 w-48 rounded-full" style={{ background: '#333b44', boxShadow: 'var(--shadow-card)' }} />
    </motion.div>
  );
}
