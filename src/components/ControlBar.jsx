function TriggerButton({ label, sub, tone, onClick, disabled }) {
  const toneMap = {
    danger: 'border-red-500/50 text-red-300 hover:bg-red-500/15',
    urgent: 'border-amber-500/50 text-amber-300 hover:bg-amber-500/15',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-lg border font-body text-left transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${toneMap[tone]}`}
    >
      <div className="text-xs font-semibold leading-tight">{label}</div>
      <div className="text-[10px] font-mono opacity-70 leading-tight">{sub}</div>
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
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 border-b border-slate-800 bg-ink-900/80">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setRunning((r) => !r)}
          className="w-9 h-9 rounded-lg bg-accent hover:bg-blue-500 flex items-center justify-center text-white transition-colors"
          title={running ? '일시정지' : '재생'}
        >
          {running ? (
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M6 4l14 8-14 8z" /></svg>
          )}
        </button>
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2.5 py-1.5 text-xs font-mono font-semibold transition-colors ${
                speed === s ? 'bg-accent text-white' : 'bg-transparent text-slate-400 hover:bg-slate-800'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <button
          onClick={onReset}
          className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-mono"
          title="시나리오 초기화"
        >
          RESET
        </button>
      </div>

      <div className="w-px h-8 bg-slate-800" />

      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Event Trigger</span>
      <div className="flex items-center gap-2">
        <TriggerButton
          label="① 병목 발생"
          sub="Bottleneck"
          tone="danger"
          onClick={onBottleneck}
          disabled={cooldown.bottleneck}
        />
        <TriggerButton
          label="② 긴급 오더 투입"
          sub="Urgent Order"
          tone="urgent"
          onClick={onUrgent}
          disabled={cooldown.urgent}
        />
        <TriggerButton
          label="③ 설비 고장"
          sub="Equipment Failure"
          tone="danger"
          onClick={onFailure}
          disabled={cooldown.failure}
        />
      </div>
    </div>
  );
}
