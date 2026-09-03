import { motion } from 'framer-motion';

// The analysis terminal. Deliberately the plainest thing on screen: black
// ground, monospace, one line at a time. It reads as the system doing work
// rather than as another styled panel, which is what makes the polished
// decision card that follows land as a conclusion.
const LINE_MS = 750;      // how long one line takes to appear
const CHAR_MS = 26;       // per-character typing speed when `typed` is on
const TAIL_MS = 1500;     // beat after the last line before it closes

export function cmdDuration(lines, typed) {
  if (!typed) return lines.length * LINE_MS + TAIL_MS;
  return lines.reduce((sum, l) => sum + l.text.length * CHAR_MS + 320, 0) + TAIL_MS;
}

// How many lines are visible, and how much of the newest one is typed.
function progress(lines, elapsed, typed) {
  if (!typed) {
    const shown = Math.min(lines.length, Math.floor(elapsed / LINE_MS) + 1);
    return { shown, partial: lines[shown - 1]?.text.length ?? 0 };
  }
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    const span = lines[i].text.length * CHAR_MS + 320;
    if (elapsed < acc + span) {
      return { shown: i + 1, partial: Math.floor((elapsed - acc) / CHAR_MS) };
    }
    acc += span;
  }
  return { shown: lines.length, partial: lines[lines.length - 1].text.length };
}

export default function CmdWindow({ title, lines, elapsed, typed = false }) {
  const { shown, partial } = progress(lines, elapsed, typed);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.28 }}
      className="w-[700px] max-w-[94vw] overflow-hidden rounded-xl border border-[#1f3a2a] shadow-2xl"
      style={{ background: '#04070a', boxShadow: '0 0 60px -12px rgba(52,211,153,.35)' }}
    >
      <div className="flex items-center gap-2 border-b border-[#16281e] bg-[#080d11] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ef5350]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5a53c]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#3ecf8e]/70" />
        <span className="ml-2 font-mono text-ui-meta tracking-wide text-slate-500">{title}</span>
      </div>

      <div className="min-h-[260px] px-5 py-4 font-mono text-ui-card leading-[1.85]">
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
