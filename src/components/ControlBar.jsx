import { TOTAL_ORDERS } from '../hooks/useSimulation.js';

// One command bar. The app previously carried a brand header and a separate
// control strip stacked on top of each other, which spent ~100px of vertical
// room on two weak edges and split "what is this" from "how do I drive it".
// Merged: identity left, transport in the middle, scenario triggers right.
function TriggerButton({ index, label, tone, onClick, disabled }) {
  const toneMap = {
    danger: { border: 'rgba(239,83,80,.45)', text: '#f3928f', hover: 'rgba(239,83,80,.14)' },
    warn: { border: 'rgba(229,165,60,.45)', text: '#eabc71', hover: 'rgba(229,165,60,.14)' },
  };
  const t = toneMap[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ borderColor: t.border, color: t.text, '--hover': t.hover }}
      className="group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-30"
    >
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded font-mono text-ui-micro font-bold"
        style={{ background: t.hover, color: t.text }}
      >
        {index}
      </span>
      <span className="text-ui-card font-semibold leading-none">{label}</span>
    </button>
  );
}

export default function ControlBar({
  running,
  setRunning,
  speed,
  setSpeed,
  onBottleneck,
  onUrgent,
  onFailure,
  onReset,
  cooldown,
  completed,
  urgentCompleted,
}) {
  return (
    <header className="flex flex-shrink-0 items-center gap-4 border-b border-ink-700 bg-ink-900 px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-blue-800 font-display text-ui-lead font-bold text-white">
          W
        </span>
        <span className="leading-none">
          <span className="block font-display text-ui-lead font-bold tracking-tight text-slate-100">
            WCS Simulator
          </span>
          <span className="block font-mono text-ui-micro tracking-[0.12em] text-slate-500">
            물류센터 통합 제어
          </span>
        </span>
      </div>

      <span className="h-8 w-px bg-ink-700" />

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setRunning((r) => !r)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-soft"
          title={running ? '일시정지' : '재생'}
        >
          {running ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M6 4l14 8-14 8z" /></svg>
          )}
        </button>
        <div className="flex overflow-hidden rounded-lg border border-ink-700">
          {[1, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2.5 py-2 font-mono text-ui-meta font-bold transition-colors ${
                speed === s ? 'bg-accent text-white' : 'text-slate-500 hover:bg-ink-800 hover:text-slate-300'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <button
          onClick={onReset}
          className="rounded-lg border border-ink-700 px-2.5 py-2 font-mono text-ui-meta text-slate-500 transition-colors hover:bg-ink-800 hover:text-slate-300"
          title="시나리오 초기화"
        >
          RESET
        </button>
      </div>

      {/* Run progress, as the one figure that belongs up here: how far
          through the 1,000-order scenario this run is. The absolute totals
          live in the dashboard strip and are not repeated. */}
      <span className="h-8 w-px bg-ink-700" />
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-ui-micro uppercase tracking-[0.12em] text-slate-500">진행률</span>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-ok transition-[width] duration-500"
            style={{ width: `${Math.min(100, (completed / TOTAL_ORDERS) * 100)}%` }}
          />
        </div>
        <span className="font-mono text-ui-meta tabular-nums text-slate-400">
          {completed.toLocaleString()}
          <span className="text-slate-600"> / {TOTAL_ORDERS.toLocaleString()}</span>
        </span>
        {urgentCompleted > 0 && (
          <span className="rounded border border-warn/40 px-1.5 py-0.5 font-mono text-ui-micro text-warn">
            긴급 {urgentCompleted}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <span className="font-mono text-ui-micro tracking-[0.14em] text-slate-600">돌발 상황</span>
        <div className="flex items-center gap-2">
          <TriggerButton index="1" label="병목 발생" tone="danger" onClick={onBottleneck} disabled={cooldown.bottleneck} />
          <TriggerButton index="2" label="긴급 오더" tone="warn" onClick={onUrgent} disabled={cooldown.urgent} />
          <TriggerButton index="3" label="설비 고장" tone="danger" onClick={onFailure} disabled={cooldown.failure} />
        </div>
      </div>
    </header>
  );
}
