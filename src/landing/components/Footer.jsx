import { Boxes, ArrowUpRight } from 'lucide-react';
import { ScrewCorners } from './Chrome.jsx';

// The footer used to carry three columns of href="#" links (Platform,
// Documentation, Changelog, Status, About, Contact) - the same dead-link
// problem the nav had, twelve times over. None of those pages exist, so the
// footer now states what this is and offers the one destination that does.
export default function Footer() {
  return (
    <footer className="relative mt-8 border-t border-black/5 px-6 py-12" style={{ background: 'var(--panel)' }}>
      <ScrewCorners inset={16} />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]"
              style={{ background: 'var(--dark-bg)', boxShadow: 'var(--shadow-sharp)' }}
            >
              <Boxes className="h-4.5 w-4.5 text-[var(--accent)]" strokeWidth={2} />
            </span>
            <span className="font-mono-ind text-sm font-bold uppercase tracking-[0.08em]">
              <span className="text-[var(--accent)]">WCS</span>
              <span className="text-[var(--text-muted)]">.Sim</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
            A tactile control-room simulator for warehouse automation planning.
            Model the flow before you pour concrete.
          </p>
        </div>

        <a
          href="simulator.html"
          className="group inline-flex items-center gap-2 self-start font-mono-ind text-xs uppercase tracking-widest text-[var(--text)] transition-colors hover:text-[var(--accent)] md:self-auto"
        >
          Open the simulator
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.5} />
        </a>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl items-center justify-between border-t border-black/5 pt-6 font-mono-ind text-[11px] uppercase tracking-widest text-[var(--text-muted)]/70">
        <span>© 2026 WCS.Sim</span>
        <span>Unit rev. 04.02</span>
      </div>
    </footer>
  );
}
