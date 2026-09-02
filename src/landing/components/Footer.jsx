import { Boxes } from 'lucide-react';
import { ScrewCorners } from './Chrome.jsx';

const COLS = [
  { title: 'Platform', items: ['Simulation Engine', 'Equipment Library', 'Routing Rules'] },
  { title: 'Resources', items: ['Documentation', 'Changelog', 'Status'] },
  { title: 'Company', items: ['About', 'Contact'] },
];

export default function Footer() {
  return (
    <footer className="relative mt-8 border-t border-black/5 px-6 py-14" style={{ background: 'var(--panel)' }}>
      <ScrewCorners inset={16} />
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]"
              style={{ background: 'var(--dark-bg)', boxShadow: 'var(--shadow-sharp)' }}
            >
              <Boxes className="h-4.5 w-4.5 text-[var(--accent)]" strokeWidth={2} />
            </span>
            <span className="font-mono-ind text-sm font-bold uppercase tracking-[0.08em] text-[var(--text)]">
              WCS<span className="text-[var(--accent)]">.</span>Sim
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--text-muted)]">
            A tactile control-room simulator for warehouse automation planning —
            model the flow before you pour concrete.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="font-mono-ind text-[11px] uppercase tracking-widest text-[var(--text)]">
                {col.title}
              </h4>
              <ul className="mt-4 flex flex-col gap-3">
                {col.items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl items-center justify-between border-t border-black/5 pt-6 font-mono-ind text-[11px] uppercase tracking-widest text-[var(--text-muted)]/70">
        <span>© 2026 WCS.Sim</span>
        <span>Unit rev. 04.02</span>
      </div>
    </footer>
  );
}
