import { motion } from 'framer-motion';

// Inbound rate, outbound rate, and how they have moved. This is the only
// number panel left on the board: an executive needs to know things are
// going in, things are coming out, and whether the line is keeping up.
//
// The trend is drawn by hand rather than pulled from a chart library: at this
// size a library brings axes, margins and a tooltip layer that all have to be
// switched off again, and the shape is two paths over a shared scale.
function Spark({ history, width = 268, height = 54 }) {
  const pts = history.slice(-40);
  if (pts.length < 2) return <div style={{ height }} />;

  const max = Math.max(3, ...pts.map((p) => Math.max(p.inRate, p.outRate)));
  const stepX = width / (pts.length - 1);
  const y = (v) => height - (v / max) * (height - 6) - 3;
  const path = (key) => pts.map((p, i) => `${i ? 'L' : 'M'}${(i * stepX).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
  const area = (key) => `${path(key)}L${width},${height}L0,${height}Z`;

  return (
    <svg width={width} height={height} className="block overflow-visible">
      <defs>
        <linearGradient id="tpIn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5188cf" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#5188cf" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="tpOut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3ecf8e" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3ecf8e" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* a single reference line at the top of the shared scale, so the two
          series can be compared rather than just admired */}
      <line x1="0" y1={y(max)} x2={width} y2={y(max)} stroke="rgba(148,163,184,.16)" strokeDasharray="3 4" />
      <text x={width - 2} y={y(max) + 10} textAnchor="end" fontSize="9" fill="#67748f" fontFamily="monospace">
        {max}
      </text>
      <path d={area('inRate')} fill="url(#tpIn)" />
      <path d={area('outRate')} fill="url(#tpOut)" />
      <path d={path('inRate')} fill="none" stroke="#5188cf" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={path('outRate')} fill="none" stroke="#3ecf8e" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function Rate({ label, value, color }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="font-mono text-ui-micro uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="flex items-baseline gap-1">
        <motion.span
          key={value}
          initial={{ scale: 1.16, color }}
          animate={{ scale: 1, color: '#eef2f9' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="font-mono text-ui-stat font-bold tabular-nums"
        >
          {value}
        </motion.span>
        <span className="font-mono text-ui-meta text-slate-500">건/초</span>
      </span>
    </div>
  );
}

export default function ThroughputPanel({ history }) {
  const last = history[history.length - 1] || { inRate: 0, outRate: 0 };

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-900/95 px-4 py-3.5 shadow-panel backdrop-blur-sm">
      <div className="flex items-stretch gap-4">
        <Rate label="입고 처리량" value={last.inRate} color="#5188cf" />
        <span className="w-px bg-ink-700" />
        <Rate label="출고 처리량" value={last.outRate} color="#3ecf8e" />
      </div>

      <div className="mt-3 border-t border-ink-700/70 pt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-ui-micro uppercase tracking-[0.12em] text-slate-500">처리량 추이</span>
          <span className="flex items-center gap-3 font-mono text-ui-micro">
            <span className="flex items-center gap-1 text-slate-400">
              <span className="h-0.5 w-3 rounded" style={{ background: '#5188cf' }} />입고
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="h-0.5 w-3 rounded" style={{ background: '#3ecf8e' }} />출고
            </span>
          </span>
        </div>
        <Spark history={history} />
      </div>
    </section>
  );
}
