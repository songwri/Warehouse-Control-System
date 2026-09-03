import { motion } from 'framer-motion';
import avatar from '../assets/wcs-avatar.png';

export const TONE = {
  info: { accent: '#60a5fa', border: 'rgba(96,165,250,.55)' },
  danger: { accent: '#f87171', border: 'rgba(248,113,113,.6)' },
  urgent: { accent: '#fbbf24', border: 'rgba(251,191,36,.6)' },
};

// The WCS character. It idles with a slow float so the panel reads as
// something speaking to you rather than a static illustration, and the drop
// shadow under it moves in counterpoint so the float looks like lift rather
// than the whole image sliding.
export function WcsAvatar({ size = 92, speaking = true }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size * 0.92 }}>
      <motion.div
        className="absolute left-1/2 rounded-[50%] bg-black/55 blur-[6px]"
        style={{ bottom: -4, width: size * 0.5, height: size * 0.09, x: '-50%' }}
        animate={speaking ? { scaleX: [1, 0.82, 1], opacity: [0.5, 0.32, 0.5] } : { scaleX: 1, opacity: 0.5 }}
        transition={speaking ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
      />
      <motion.img
        src={avatar}
        alt=""
        className="relative h-full w-full select-none object-contain"
        draggable={false}
        animate={speaking ? { y: [0, -7, 0] } : { y: 0 }}
        transition={speaking ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
      />
    </div>
  );
}

export function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="설명 닫고 계속하기"
      title="닫기 (Esc)"
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-ink-700 text-slate-500 transition-colors hover:border-ink-600 hover:bg-ink-800 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4 w-4">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

export function ProgressBar({ pct, accent }) {
  return (
    <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-ink-800">
      <div
        className="h-full rounded-full transition-[width] duration-100 ease-linear"
        style={{ background: accent, width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}
