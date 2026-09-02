import { AnimatePresence, motion } from 'framer-motion';

const TONE_STYLE = {
  info: 'border-accent-soft/50 bg-ink-900/95 text-slate-100',
  ok: 'border-ok/60 bg-emerald-950/90 text-emerald-200',
  danger: 'border-red-500/60 bg-red-950/90 text-red-200',
  urgent: 'border-amber-500/60 bg-amber-950/90 text-amber-200',
};

export default function Toasts({ events }) {
  return (
    <div className="absolute right-4 top-3 z-50 flex flex-col gap-2 w-[300px] pointer-events-none">
      <AnimatePresence>
        {events.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`rounded-lg border px-3.5 py-2.5 text-xs font-body shadow-lg backdrop-blur-sm ${TONE_STYLE[e.tone] || TONE_STYLE.info}`}
          >
            {e.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
