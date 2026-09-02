import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STEP_INTERVAL_MS = 1100;
const HOLD_AFTER_MS = 2600;
const MODAL_STEP_MS = 1500;
const MODAL_HOLD_MS = 1700;
// routine decisions (inbound, grouping) run brisker than incident responses
const BRISK_STEP_MS = 1050;
const BRISK_HOLD_MS = 1200;

const TONE = {
  info: { accent: '#60a5fa', border: 'rgba(96,165,250,.55)' },
  danger: { accent: '#f87171', border: 'rgba(248,113,113,.6)' },
  urgent: { accent: '#fbbf24', border: 'rgba(251,191,36,.6)' },
};

// Narrates one WCS decision step by step in plain text.
//
// Two variants:
//  - corner (default): a small card, shown once per decision type while the
//    simulation keeps running behind it.
//  - modal: for presenter-fired events. The caller freezes the simulation,
//    the screen dims, and the decision plays out large and centre-stage;
//    onFinish then applies the decision's effect and resumes.
export default function DecisionStory({ story, onFinish }) {
  const [revealed, setRevealed] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!story) return;
    const modal = !!story.modal;
    const brisk = story.pace === 'brisk';
    const stepMs = modal ? (brisk ? BRISK_STEP_MS : MODAL_STEP_MS) : STEP_INTERVAL_MS;
    const holdMs = modal ? (brisk ? BRISK_HOLD_MS : MODAL_HOLD_MS) : HOLD_AFTER_MS;

    setRevealed(0);
    setVisible(true);
    const timers = story.steps.map((_, i) => setTimeout(() => setRevealed(i + 1), i * stepMs));
    timers.push(
      setTimeout(() => {
        setVisible(false);
        // A modal story owns the paused simulation, so it must hand control
        // back; a corner story just fades itself out.
        if (modal) onFinish?.();
      }, story.steps.length * stepMs + holdMs)
    );
    return () => timers.forEach(clearTimeout);
  }, [story, onFinish]);

  if (!story) return null;
  const tone = TONE[story.tone] || TONE.info;
  const briskPace = story.pace === 'brisk';
  const total =
    story.steps.length * (story.modal ? (briskPace ? BRISK_STEP_MS : MODAL_STEP_MS) : STEP_INTERVAL_MS) +
    (story.modal ? (briskPace ? BRISK_HOLD_MS : MODAL_HOLD_MS) : HOLD_AFTER_MS);

  if (story.modal) {
    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            key={story.id}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/85 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-[600px] max-w-[92vw] rounded-2xl border bg-ink-950/95 px-8 py-7 shadow-2xl"
              style={{ borderColor: tone.border, boxShadow: `0 0 60px -12px ${tone.accent}` }}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full pulse-ring" style={{ background: tone.accent }} />
                  <span className="font-display text-lg font-bold tracking-wide" style={{ color: tone.accent }}>
                    {story.title}
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Simulation Paused
                </span>
              </div>

              <ol className="mt-5 flex flex-col gap-4">
                {story.steps.map((step, i) => {
                  const shown = i < revealed;
                  return (
                    <motion.li
                      key={i}
                      initial={false}
                      animate={{ opacity: shown ? 1 : 0.12, x: shown ? 0 : -10 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      className="flex items-start gap-3.5"
                    >
                      <span
                        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm"
                        style={{
                          background: shown ? `${tone.accent}22` : 'rgba(148,163,184,.08)',
                          border: `1px solid ${shown ? tone.border : 'rgba(148,163,184,.15)'}`,
                        }}
                      >
                        {step.icon}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span
                          className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                          style={{ color: shown ? tone.accent : '#475569' }}
                        >
                          {step.label}
                        </span>
                        <span className={`text-[14.5px] leading-snug ${shown ? 'text-slate-100' : 'text-slate-600'}`}>
                          {step.text}
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </ol>

              <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: tone.accent }}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: total / 1000, ease: 'linear' }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {visible && (
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
