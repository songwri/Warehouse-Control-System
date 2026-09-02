const PATHS = {
  // Robotic arm (inbound/outbound "로봇암" dock) — articulated arm + gripper,
  // deliberately NOT a forklift shape.
  'robot-arm': (
    <>
      <rect x="8" y="17" width="8" height="3.5" rx="1" />
      <path d="M12 17v-6" />
      <path d="M12 11l6-3.2" />
      <path d="M18 7.8l2.4-2.6" />
      <path d="M21.4 4l-1.6 1.2M21.4 4l-1.2 1.8" />
      <circle cx="12" cy="11" r="1.3" />
      <circle cx="18" cy="7.8" r="1.1" />
    </>
  ),
  // Forklift — shared shape for both 무인지게차(auto) and 일반지게차(manual);
  // callers differentiate the two with color/opacity, not silhouette.
  forklift: (
    <>
      <rect x="2.5" y="10" width="9" height="7" rx="1.2" />
      <path d="M12 7.5v10" />
      <path d="M12 9.5h8.5l-1.2 4h-7.3" />
      <path d="M12 13h6.8l-1 3.4h-5.8" />
      <circle cx="6" cy="19" r="1.6" />
      <circle cx="10.5" cy="19" r="1.6" />
    </>
  ),
  // Delivery truck for the inbound vehicle animation.
  truck: (
    <>
      <rect x="2" y="9" width="12" height="8" rx="1" />
      <path d="M14 12h4.5l3 3.2V17H14z" />
      <circle cx="6.5" cy="19" r="1.7" />
      <circle cx="17.5" cy="19" r="1.7" />
      <line x1="4.5" y1="12" x2="4.5" y2="14.5" />
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
  // DAS (Digital Assort System) — a branching funnel, distinct from the
  // Libiao 3D Sorter's radial-spoke shape.
  das: (
    <>
      <path d="M4.5 4h15l-5.5 7.5v8h-4v-8z" />
      <path d="M4.5 4l5.5 7.5M19.5 4L14 11.5" />
    </>
  ),
  // AMR — compact transport robot: low rounded body, not a cart or forklift.
  amr: (
    <>
      <rect x="4" y="9" width="16" height="9" rx="3" />
      <circle cx="9" cy="13.5" r="1.3" />
      <circle cx="15" cy="13.5" r="1.3" />
      <path d="M12 9V5" />
      <circle cx="12" cy="4" r="1.1" />
    </>
  ),
  // DPC — hand/pick cart: platform + rising handle, two wheels.
  dpc: (
    <>
      <rect x="5" y="11" width="12" height="5" rx="1" />
      <path d="M5 11V5h3.5" />
      <line x1="5" y1="16" x2="5" y2="11" />
      <circle cx="8.5" cy="19.5" r="1.6" />
      <circle cx="15" cy="19.5" r="1.6" />
    </>
  ),
  // DPS — Digital Picking System: pick-to-light display on a stand.
  dps: (
    <>
      <rect x="4" y="4" width="16" height="11" rx="1.5" />
      <path d="M9 19.5h6M12 15v4.5" />
      <circle cx="8" cy="9.3" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="9.3" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9.3" r="1" fill="currentColor" stroke="none" />
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
