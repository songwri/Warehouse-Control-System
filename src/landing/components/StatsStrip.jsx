const STATS = [
  { value: '1,000', unit: 'orders', label: 'Per demo run' },
  { value: '12', unit: 'stations', label: 'Modeled equipment' },
  { value: '18%', unit: 'avg.', label: 'Lead-time reduction' },
  { value: '4.2s', unit: 'p50', label: 'Order-to-route decision' },
];

export default function StatsStrip() {
  return (
    <section className="px-6 pb-20">
      <div
        className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-xl)] md:grid-cols-4"
        style={{ background: 'var(--border-shadow)', boxShadow: 'var(--shadow-card)' }}
      >
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 bg-[var(--panel)] px-6 py-8">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono-ind text-3xl font-bold tabular-nums text-[var(--text)] md:text-4xl">
                {s.value}
              </span>
              <span className="font-mono-ind text-[11px] uppercase tracking-widest text-[var(--accent)]">
                {s.unit}
              </span>
            </div>
            <span className="text-sm text-[var(--text-muted)]">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
