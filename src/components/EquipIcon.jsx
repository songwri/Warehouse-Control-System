const PATHS = {
  'auto-in': (
    <>
      <rect x="3" y="8" width="11" height="9" rx="1.5" />
      <path d="M14 11h4l3 3v3h-7z" />
      <circle cx="7" cy="19" r="1.6" />
      <circle cx="17.5" cy="19" r="1.6" />
    </>
  ),
  'auto-out': (
    <>
      <rect x="3" y="8" width="11" height="9" rx="1.5" />
      <path d="M14 11h4l3 3v3h-7z" />
      <circle cx="7" cy="19" r="1.6" />
      <circle cx="17.5" cy="19" r="1.6" />
    </>
  ),
  'manual-in': (
    <>
      <rect x="3" y="8" width="11" height="9" rx="1.5" />
      <path d="M14 11h4l3 3v3h-7z" />
      <circle cx="7" cy="19" r="1.6" />
      <circle cx="17.5" cy="19" r="1.6" />
      <path d="M6 4l2 3M18 4l-2 3" />
    </>
  ),
  'manual-out': (
    <>
      <rect x="3" y="8" width="11" height="9" rx="1.5" />
      <path d="M14 11h4l3 3v3h-7z" />
      <circle cx="7" cy="19" r="1.6" />
      <circle cx="17.5" cy="19" r="1.6" />
      <path d="M6 4l2 3M18 4l-2 3" />
    </>
  ),
  climber: (
    <>
      <rect x="4" y="3" width="6" height="18" rx="1" />
      <rect x="13" y="7" width="7" height="6" rx="1" />
      <path d="M7 3V1M17 7l3-3" />
    </>
  ),
  shuttle: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="14" x2="21" y2="14" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </>
  ),
  rack: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
    </>
  ),
  sorter: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  amr: (
    <>
      <rect x="4" y="9" width="16" height="9" rx="3" />
      <circle cx="9" cy="13.5" r="1.3" />
      <circle cx="15" cy="13.5" r="1.3" />
      <path d="M12 9V5" />
      <circle cx="12" cy="4" r="1.1" />
    </>
  ),
  'pack-auto': (
    <>
      <path d="M12 3 20 7v10l-8 4-8-4V7z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
    </>
  ),
  'pack-manual': (
    <>
      <path d="M12 3 20 7v10l-8 4-8-4V7z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
      <path d="M9 2l1.5 2M15 2l-1.5 2" />
    </>
  ),
  brain: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 6v12M8 8.5l8 7M16 8.5l-8 7" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8l8 8M16 8l-8 8" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 22 20H2z" />
      <line x1="12" y1="9" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
};

export default function EquipIcon({ name, className = 'w-5 h-5', style }) {
  const path = PATHS[name] || PATHS.brain;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      {path}
    </svg>
  );
}
