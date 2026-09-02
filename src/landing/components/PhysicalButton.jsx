const SIZE = {
  sm: 'h-10 px-4 text-xs',
  default: 'h-12 px-6 text-sm',
  lg: 'h-14 px-8 text-base',
};

const VARIANT = {
  // Primary / accent - "the emergency stop button". Used for Watch Demo.
  primary:
    'bg-[var(--accent)] text-[var(--accent-foreground)] border border-white/25 ' +
    'shadow-[var(--shadow-primary)] hover:brightness-110 ' +
    'active:shadow-[var(--shadow-primary-pressed)] active:translate-y-[2px] active:brightness-100',
  // Secondary / chassis - neutral grey physical key. Used for Start.
  secondary:
    'bg-[var(--background)] text-[var(--text-muted)] border border-black/5 hover:text-[var(--text)] ' +
    'shadow-[var(--shadow-card)] ' +
    'active:shadow-[var(--shadow-pressed)] active:translate-y-[2px]',
  // Ghost / flat label - nav links
  ghost:
    'bg-transparent text-[var(--text-muted)] hover:bg-[var(--muted)] hover:text-[var(--text)] ' +
    'active:shadow-[var(--shadow-recessed)] active:translate-y-[1px]',
};

export default function PhysicalButton({ variant = 'primary', size = 'default', className = '', children, ...props }) {
  return (
    <button
      className={[
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
        'rounded-[var(--radius-lg)] font-mono-ind font-bold uppercase tracking-[0.06em]',
        'transition-all duration-150',
        SIZE[size],
        VARIANT[variant],
        className,
      ].join(' ')}
      style={{ transitionTimingFunction: 'var(--ease-mech)' }}
      {...props}
    >
      {children}
    </button>
  );
}
