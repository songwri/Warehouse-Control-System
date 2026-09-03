import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// The analysis terminal. Deliberately the plainest thing on screen: black
// ground, monospace, one line at a time. It reads as the system doing work
// rather than as another styled panel, which is what makes the polished
// decision card that follows land as a conclusion.
const LINE_MS = 750;      // how long one line takes to appear
const CHAR_MS = 26;       // per-character typing speed when `typed` is on
const TAIL_MS = 1500;     // beat after the last line before it closes

// `rate` scales how fast the window runs. The outbound analysis is the one
// screen in the demo dense enough that a viewer has to actually read it, so
// it plays at half speed; the incident terminals stay at 1x.
export function cmdDuration(lines, typed, rate = 1) {
  const line = LINE_MS / rate;
  const char = CHAR_MS / rate;
  if (!typed) return lines.length * line + TAIL_MS;
  return lines.reduce((sum, l) => sum + l.text.length * char + 320 / rate, 0) + TAIL_MS;
}

// How many lines are visible, and how much of the newest one is typed.
function progress(lines, elapsed, typed, rate = 1) {
  const line = LINE_MS / rate;
  const char = CHAR_MS / rate;
  if (!typed) {
    const shown = Math.min(lines.length, Math.floor(elapsed / line) + 1);
    return { shown, partial: lines[shown - 1]?.text.length ?? 0 };
  }
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    const span = lines[i].text.length * char + 320 / rate;
    if (elapsed < acc + span) {
      return { shown: i + 1, partial: Math.floor((elapsed - acc) / char) };
    }
    acc += span;
  }
  return { shown: lines.length, partial: lines[lines.length - 1].text.length };
}

export default function CmdWindow({ title, lines, elapsed, typed = false, rate = 1 }) {
  const { shown, partial } = progress(lines, elapsed, typed, rate);

  // A long report outgrows the window, so the view follows the line being
  // written. Without this the terminal keeps typing below the fold and the
  // reader is left staring at the opening lines while the answer scrolls
  // past out of sight.
  const bodyRef = useRef(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.28 }}
      className="w-full max-w-[700px] overflow-hidden rounded-xl border border-[#1f3a2a] shadow-2xl"
      style={{ background: '#04070a', boxShadow: '0 0 60px -12px rgba(52,211,153,.35)' }}
    >
      <div className="flex items-center gap-2 border-b border-[#16281e] bg-[#080d11] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ef5350]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5a53c]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#3ecf8e]/70" />
        <span className="ml-2 font-mono text-ui-meta tracking-wide text-slate-500">{title}</span>
      </div>

      <div ref={bodyRef} className="max-h-[320px] min-h-[200px] overflow-y-auto px-5 py-3 font-mono text-ui-body leading-[1.8]">
        {lines.slice(0, shown).map((l, i) => {
          const isLast = i === shown - 1;
          const text = isLast && typed ? l.text.slice(0, partial) : l.text;
          const complete = !isLast || !typed || partial >= l.text.length;
          return (
            <div
              key={i}
              className="flex items-baseline gap-2"
              style={{ paddingLeft: l.indent ? 18 : 0, color: l.dim ? '#5f8f74' : '#9fe8c0' }}
            >
              {!l.indent && <span className="text-[#3ecf8e]/50">&gt;</span>}
              <span className="flex-1 whitespace-pre">{text}</span>
              {complete && l.value && <span className="text-slate-300">{l.value}</span>}
              {complete && l.ok && <span className="font-bold text-[#3ecf8e]">[OK]</span>}
              {isLast && !complete && <span className="inline-block h-[13px] w-[7px] bg-[#3ecf8e] blink-fast" />}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
