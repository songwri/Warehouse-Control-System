import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CmdWindow, { cmdDuration } from './CmdWindow.jsx';
import { TONE, WcsAvatar, CloseButton, ProgressBar } from './StoryChrome.jsx';

// One cinematic runs ~20s: long enough to actually read all three stages.
const INTRO_MS = 700;
const TYPE_MS = 2900; // typewriter window for one line
const OK_MS = 550; // beat between the line finishing and its OK stamp
const DWELL_MS = 2300; // reading pause before the next stage lights up
const STAGE_MS = TYPE_MS + OK_MS + DWELL_MS;
const OUTRO_MS = 2500;
const TOTAL_MS = INTRO_MS + 3 * STAGE_MS + OUTRO_MS;

const CORNER_STEP_MS = 1100;
const CORNER_HOLD_MS = 2600;

// Scripted-opening beats. A banner is a title card; candidates is WCS showing
// its options and picking one; terminal is the raw analysis window.
const BANNER_MS = 4200;
const CAND_INTRO_MS = 900;
const CAND_STEP_MS = 800;   // each option appearing in turn
const CAND_VERDICT_MS = 2600;

// How long the whole thing runs, by kind.
function runtimeOf(story) {
  if (!story) return TOTAL_MS;
  if (story.kind === 'banner') return BANNER_MS;
  if (story.kind === 'terminal') return cmdDuration(story.lines, story.typed);
  if (story.kind === 'candidates') {
    return CAND_INTRO_MS + story.options.length * CAND_STEP_MS + CAND_VERDICT_MS;
  }
  return TOTAL_MS;
}

// The three stages every WCS decision passes through, laid out left to right.
const STAGES = [
  {
    key: 'detect',
    label: '상황 인지',
    sub: 'DETECT',
    icon: (
      <>
        <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  {
    key: 'evaluate',
    label: '대안 탐색',
    sub: 'EVALUATE',
    icon: (
      <>
        <path d="M6 3v6a3 3 0 0 0 3 3h9" />
        <path d="M6 21v-6a3 3 0 0 1 3-3" />
        <path d="M15 9l3 3-3 3" />
        <circle cx="6" cy="3" r="1.4" />
        <circle cx="6" cy="21" r="1.4" />
      </>
    ),
  },
  {
    key: 'decide',
    label: '최적 결정',
    sub: 'DECIDE',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.4l2.6 2.6L16 9.6" />
      </>
    ),
  },
];

function StageIcon({ paths, className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths}
    </svg>
  );
}

function OkStamp({ accent }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.175, 0.885, 0.32, 1.4] }}
      className="ml-2 inline-flex flex-shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 align-middle font-mono text-ui-meta font-bold"
      style={{ color: '#34d399', borderColor: 'rgba(52,211,153,.55)', background: 'rgba(52,211,153,.12)' }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
        <path d="M4 12.5l5 5L20 6.5" />
      </svg>
      OK
    </motion.span>
  );
}

// Narrates one WCS decision.
//
//  - modal: the caller freezes the board. Three stages light up left to right;
//    under them each line types out and gets stamped OK before the next
//    stage begins. onFinish then applies the effect and resumes playback.
//  - corner: a small card for anything that should not stop the board.
export default function DecisionStory({ story, onFinish }) {
  const [elapsed, setElapsed] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [visible, setVisible] = useState(false);
  const finishedRef = useRef(false);

  const modal = !!story?.modal;
  const kind = story?.kind || 'stages';
  const runtime = runtimeOf(story);

  // Ends the cinematic early. It still calls onFinish, so the decision the
  // narration was explaining is applied and the board resumes: closing skips
  // the explanation, it does not cancel the event being explained.
  const dismiss = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setVisible(false);
    onFinish?.();
  }, [onFinish]);

  // modal: one clock drives staging, typing and the OK stamps
  useEffect(() => {
    if (!story || !modal) return;
    finishedRef.current = false;
    setElapsed(0);
    setVisible(true);
    const startedAt = Date.now();
    const iv = setInterval(() => {
      const e = Date.now() - startedAt;
      setElapsed(e);
      if (e >= runtime) dismiss();
    }, 50);
    return () => clearInterval(iv);
  }, [story, modal, runtime, dismiss]);

  // Escape closes it too - a modal that traps you until a timer runs out is
  // the one thing a viewer will reach for the keyboard over.
  useEffect(() => {
    if (!story || !modal) return;
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [story, modal, dismiss]);

  // corner variant keeps its simple stepped reveal
  useEffect(() => {
    if (!story || modal) return;
    setRevealed(0);
    setVisible(true);
    const timers = story.steps.map((_, i) => setTimeout(() => setRevealed(i + 1), i * CORNER_STEP_MS));
    timers.push(setTimeout(() => setVisible(false), story.steps.length * CORNER_STEP_MS + CORNER_HOLD_MS));
    return () => timers.forEach(clearTimeout);
  }, [story, modal]);

  if (!story) return null;
  const tone = TONE[story.tone] || TONE.info;

  const overlay = (children) => (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={story.id}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/92 backdrop-blur-[4px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ---- title card: WCS speaking straight to the room ----
  if (kind === 'banner') {
    return overlay(
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-[760px] max-w-[94vw] items-center gap-7 rounded-2xl border px-9 py-7 shadow-2xl"
        style={{ background: '#0a0f1b', borderColor: tone.border, boxShadow: `0 0 70px -14px ${tone.accent}` }}
      >
        <WcsAvatar size={104} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-ui-head font-bold leading-snug text-slate-50">{story.title}</p>
          {story.caption && <p className="mt-2 text-ui-card leading-relaxed text-slate-400">{story.caption}</p>}
          <ProgressBar pct={(elapsed / runtime) * 100} accent={tone.accent} />
        </div>
        <CloseButton onClick={dismiss} />
      </motion.div>,
    );
  }

  // ---- raw analysis terminal ----
  if (kind === 'terminal') {
    return overlay(
      <div className="flex flex-col items-center gap-4">
        <CmdWindow title={story.title} lines={story.lines} elapsed={elapsed} typed={story.typed} />
        <button
          type="button"
          onClick={dismiss}
          className="font-mono text-ui-meta uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-300"
        >
          건너뛰기 (Esc)
        </button>
      </div>,
    );
  }

  // ---- WCS weighing named options and committing to one ----
  if (kind === 'candidates') {
    const shown = Math.max(0, Math.floor((elapsed - CAND_INTRO_MS) / CAND_STEP_MS) + 1);
    const decided = elapsed >= CAND_INTRO_MS + story.options.length * CAND_STEP_MS;
    return overlay(
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-[760px] max-w-[94vw] rounded-2xl border px-9 py-8 shadow-2xl"
        style={{ background: '#0a0f1b', borderColor: tone.border, boxShadow: `0 0 70px -14px ${tone.accent}` }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-ink-700 pb-4">
          <span className="font-display text-xl font-bold tracking-wide" style={{ color: tone.accent }}>
            {story.title}
          </span>
          <CloseButton onClick={dismiss} />
        </div>

        <div className="mt-6 flex items-start gap-6">
          <WcsAvatar size={96} />
          <div className="min-w-0 flex-1">
            <p className="text-ui-lead leading-relaxed text-slate-200">{story.question}</p>

            <div className="mt-4 flex flex-col gap-2">
              {story.options.map((o, i) => {
                const visibleRow = i < shown;
                const picked = decided && o.chosen;
                const dropped = decided && !o.chosen;
                return (
                  <motion.div
                    key={o.key}
                    animate={{
                      opacity: visibleRow ? (dropped ? 0.3 : 1) : 0,
                      x: visibleRow ? 0 : -10,
                    }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5"
                    style={{
                      borderColor: picked ? tone.border : 'rgba(35,46,70,1)',
                      background: picked ? `${tone.accent}1f` : 'rgba(16,24,40,.7)',
                      boxShadow: picked ? `0 0 22px -8px ${tone.accent}` : 'none',
                    }}
                  >
                    <span
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold"
                      style={{
                        borderColor: picked ? tone.accent : 'rgba(100,116,139,.5)',
                        background: picked ? tone.accent : 'transparent',
                        color: picked ? '#0a0f1b' : '#64748b',
                      }}
                    >
                      {picked ? '✓' : i + 1}
                    </span>
                    <span className="text-ui-card font-semibold text-slate-100">{o.label}</span>
                    <span className="text-ui-meta text-slate-500">{o.note}</span>
                  </motion.div>
                );
              })}
            </div>

            <motion.p
              animate={{ opacity: decided ? 1 : 0, y: decided ? 0 : 6 }}
              transition={{ duration: 0.35 }}
              className="mt-4 text-ui-card font-bold"
              style={{ color: tone.accent }}
            >
              {story.verdict}
            </motion.p>
          </div>
        </div>

        <ProgressBar pct={(elapsed / runtime) * 100} accent={tone.accent} />
      </motion.div>,
    );
  }

  if (modal) {
    const lines = story.lines || [];
    const t = elapsed - INTRO_MS;
    const activeStage = Math.max(0, Math.min(2, Math.floor(t / STAGE_MS)));
    const inStage = t - activeStage * STAGE_MS;

    const stageState = (i) => {
      if (t < 0) return 'pending';
      if (i < activeStage) return 'done';
      if (i > activeStage) return 'pending';
      return inStage >= TYPE_MS + OK_MS ? 'done' : 'active';
    };
    // how much of line i is typed out so far
    const typedCount = (i) => {
      if (t < 0 || i > activeStage) return 0;
      if (i < activeStage) return lines[i].length;
      return Math.round(lines[i].length * Math.max(0, Math.min(1, inStage / TYPE_MS)));
    };
    const okShown = (i) => (i < activeStage ? true : i === activeStage && inStage >= TYPE_MS + OK_MS);

    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            key={story.id}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/92 backdrop-blur-[4px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-[760px] max-w-[94vw] rounded-2xl border px-9 py-8 shadow-2xl"
              style={{ background: '#0a0f1b', borderColor: tone.border, boxShadow: `0 0 70px -14px ${tone.accent}` }}
            >
              <div className="flex items-center justify-between gap-4 border-b border-ink-700 pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={t < 0 ? 'h-2.5 w-2.5 rounded-full pulse-ring' : 'h-2.5 w-2.5 rounded-full'}
                    style={{ background: tone.accent }}
                  />
                  <span className="truncate font-display text-xl font-bold tracking-wide" style={{ color: tone.accent }}>
                    {story.title}
                  </span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <span className="font-mono text-ui-micro uppercase tracking-[0.18em] text-slate-500">
                    Simulation Paused
                  </span>
                  <button
                    type="button"
                    onClick={dismiss}
                    aria-label="설명 닫고 계속하기"
                    title="닫기 (Esc)"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-700 text-slate-500 transition-colors hover:border-ink-600 hover:bg-ink-800 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4 w-4">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* three stages, left to right */}
              <div className="mt-7 flex items-start justify-between">
                {STAGES.map((stage, i) => {
                  const state = stageState(i);
                  const lit = state !== 'pending';
                  return (
                    <div key={stage.key} className="flex flex-1 items-start">
                      <div className="flex w-full flex-col items-center gap-2.5">
                        {/* Only the stage being worked pulses. `scale` and
                            `opacity` carry SEPARATE transitions on purpose:
                            with one shared `repeat: Infinity` transition,
                            Framer kept opacity animating forever on a stage
                            that had already finished, because its target
                            (1) was the same in both states and an unchanged
                            target is never restarted. The result was a
                            completed stage that went on blinking behind the
                            active one. Scoping the repeat to `scale` means a
                            done stage settles and stays settled. */}
                        <motion.div
                          animate={{
                            scale: state === 'active' ? [1, 1.07, 1] : 1,
                            opacity: lit ? 1 : 0.32,
                          }}
                          transition={{
                            scale: state === 'active'
                              ? { duration: 1.4, repeat: Infinity }
                              : { duration: 0.35 },
                            opacity: { duration: 0.35 },
                          }}
                          className="flex h-16 w-16 items-center justify-center rounded-2xl border-2"
                          style={{
                            // three clearly ranked states, brightest last:
                            // pending is dim and grey, done is settled and
                            // quiet, active is the strongest and the only one
                            // that moves or glows
                            borderColor:
                              state === 'active'
                                ? tone.border
                                : state === 'done'
                                  ? `${tone.accent}4d`
                                  : 'rgba(148,163,184,.22)',
                            background:
                              state === 'active'
                                ? `${tone.accent}2e`
                                : state === 'done'
                                  ? `${tone.accent}12`
                                  : 'rgba(148,163,184,.06)',
                            boxShadow: state === 'active' ? `0 0 26px -6px ${tone.accent}` : 'none',
                            color: state === 'active' ? tone.accent : state === 'done' ? `${tone.accent}b3` : '#64748b',
                            transition: 'background 350ms ease, border-color 350ms ease',
                          }}
                        >
                          <StageIcon paths={stage.icon} className="h-7 w-7" />
                        </motion.div>
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className="text-ui-card font-bold"
                            style={{ color: lit ? '#f1f5f9' : '#64748b' }}
                          >
                            {stage.label}
                          </span>
                          <span
                            className="font-mono text-ui-micro uppercase tracking-[0.18em]"
                            style={{ color: lit ? tone.accent : '#475569' }}
                          >
                            {stage.sub}
                          </span>
                        </div>
                      </div>
                      {i < STAGES.length - 1 && (
                        <div className="mt-8 h-0.5 w-full max-w-[86px] flex-shrink overflow-hidden rounded-full bg-ink-700">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: tone.accent }}
                            animate={{ width: i < activeStage ? '100%' : '0%' }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* the reasoning, typed out one line at a time */}
              <div className="mt-7 min-h-[128px] rounded-xl border border-ink-700 bg-ink-950/70 px-5 py-4">
                <ol className="flex flex-col gap-3">
                  {lines.map((line, i) => {
                    const chars = typedCount(i);
                    if (chars === 0 && i > activeStage) return null;
                    const typing = i === activeStage && chars < line.length;
                    return (
                      <li key={i} className="flex items-start gap-2.5">
                        <span
                          className="mt-[3px] font-mono text-ui-meta font-bold"
                          style={{ color: tone.accent }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="text-ui-lead leading-relaxed text-slate-100">
                          {line.slice(0, chars)}
                          {typing && (
                            <span className="ml-0.5 inline-block h-[15px] w-[7px] translate-y-[2px] bg-slate-100 blink-fast" />
                          )}
                          {okShown(i) && <OkStamp accent={tone.accent} />}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full rounded-full transition-[width] duration-100 ease-linear"
                  style={{ background: tone.accent, width: `${Math.min(100, (elapsed / runtime) * 100)}%` }}
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
          <div className="flex items-center gap-2 border-b border-ink-700 pb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-soft pulse-ring" />
            <span className="font-display text-ui-meta font-semibold uppercase tracking-wider text-accent-soft">
              {story.title}
            </span>
          </div>
          <ul className="mt-2.5 flex flex-col gap-2">
            {(story.steps || []).map((step, i) => (
              <AnimatePresence key={i}>
                {i < revealed && (
                  <motion.li
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex items-start gap-2 text-ui-body leading-snug ${
                      i === revealed - 1 ? 'text-slate-100' : 'text-slate-500'
                    }`}
                  >
                    <span className="text-sm leading-none">{step.icon}</span>
                    <span>{step.text}</span>
                  </motion.li>
                )}
              </AnimatePresence>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
