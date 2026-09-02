import { Boxes, Play } from 'lucide-react';
import PhysicalButton from './PhysicalButton.jsx';
import { VentSlots } from './Chrome.jsx';

// The nav carried Platform / Equipment / Simulation / Pricing, all pointing at
// anchors that do not exist on this page. A link that does nothing when clicked
// costs more trust than the four labels bought, so the bar is now identity on
// the left and the one real destination on the right. With no menu left to
// open, the mobile hamburger went too; the single button fits at every width.
export default function Nav() {
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
            <span className="text-[var(--accent)]">W</span>
            <span className="text-[var(--accent)]">C</span>
            <span className="text-[var(--accent)]">S</span>
            <span className="text-[var(--text-muted)]">.Sim</span>
          </span>
        </a>

        <div className="flex items-center gap-3">
          <VentSlots count={3} />
          <PhysicalButton variant="primary" size="sm" onClick={() => (window.location.href = 'simulator.html')}>
            <Play className="h-3.5 w-3.5" strokeWidth={2.5} />
            Watch Demo
          </PhysicalButton>
        </div>
      </div>
    </header>
  );
}
