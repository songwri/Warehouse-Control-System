import { useState } from 'react';
import { Boxes, Menu, X, Play } from 'lucide-react';
import PhysicalButton from './PhysicalButton.jsx';
import { VentSlots } from './Chrome.jsx';

const LINKS = ['Platform', 'Equipment', 'Simulation', 'Pricing'];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-[var(--background)]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]"
            style={{ background: 'var(--dark-bg)', boxShadow: 'var(--shadow-sharp)' }}
          >
            <Boxes className="h-4.5 w-4.5 text-[var(--accent)]" strokeWidth={2} />
          </span>
          <span className="font-mono-ind text-sm font-bold uppercase tracking-[0.08em] text-[var(--text)]">
            WCS<span className="text-[var(--accent)]">.</span>Sim
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              className="rounded-[var(--radius-md)] px-4 py-2 font-mono-ind text-xs uppercase tracking-wide text-[var(--text-muted)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--text)]"
            >
              {l}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <VentSlots count={3} />
          <PhysicalButton variant="primary" size="sm" onClick={() => (window.location.href = 'simulator.html')}>
            <Play className="h-3.5 w-3.5" strokeWidth={2.5} />
            Watch Demo
          </PhysicalButton>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] md:hidden"
          style={{ boxShadow: 'var(--shadow-card)' }}
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-black/5 px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase()}`}
                className="rounded-[var(--radius-md)] px-3 py-2 font-mono-ind text-xs uppercase tracking-wide text-[var(--text-muted)] hover:bg-[var(--muted)]"
              >
                {l}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex gap-3">
            <PhysicalButton variant="primary" size="sm" className="flex-1" onClick={() => (window.location.href = 'simulator.html')}>
              <Play className="h-3.5 w-3.5" strokeWidth={2.5} />
              Watch Demo
            </PhysicalButton>
          </div>
        </div>
      )}
    </header>
  );
}
