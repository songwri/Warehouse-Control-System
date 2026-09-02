import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STEP_INTERVAL_MS = 1100;
const HOLD_AFTER_MS = 2600;

// A short, readable "cutscene" that narrates a single WCS decision step by
// step in plain text - shown once per decision type (inbound classification,
// WMS grouping) so the mechanism is legible instead of a blur of tokens.
export default function DecisionStory({ story }) {
  const [revealed, setRevealed] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!story) return;
    setRevealed(0);
    setVisible(true);
    const timers = [];
    story.steps.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealed(i + 1), i * STEP_INTERVAL_MS));
    });
    timers.push(setTimeout(() => setVisible(false), story.steps.length * STEP_INTERVAL_MS + HOLD_AFTER_MS));
    return () => timers.forEach(clearTimeout);
  }, [story]);

  return (
    <AnimatePresence>
      {story && visible && (
        <motion.div
          key={story.id}
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.35 }}
          className="absolute left-4 top-4 z-[70] w-[360px] rounded-xl border border-accent-soft/40 bg-ink-950/95 px-4 py-3.5 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-soft pulse-ring" />
            <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-accent-soft">
              {story.title}
            </span>
          </div>
          <ul className="mt-2.5 flex flex-col gap-2">
            {story.steps.map((step, i) => {
              const shown = i < revealed;
              const isCurrent = i === revealed - 1;
              return (
                <AnimatePresence key={i}>
                  {shown && (
                    <motion.li
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex items-start gap-2 text-[12.5px] leading-snug ${
                        isCurrent ? 'text-slate-100' : 'text-slate-500'
                      }`}
                    >
                      <span className="text-sm leading-none">{step.icon}</span>
                      <span className={isCurrent ? 'font-medium' : ''}>{step.text}</span>
                    </motion.li>
                  )}
                </AnimatePresence>
              );
            })}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
