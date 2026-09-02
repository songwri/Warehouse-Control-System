// Stage (columns, left -> right) and lane (rows) configuration for the WCS
// process-flow simulator. Each order is assigned to one lane at spawn time
// and travels straight across all five stages in that lane, picking up the
// lane's equipment at each stage - this is what lets the audience read
// "which equipment handled this order" at a glance.

export const STAGES = [
  { key: 'inbound', label: '입고', sub: 'Inbound' },
  { key: 'storage', label: '보관', sub: 'Storage' },
  { key: 'picking', label: '피킹', sub: 'Picking' },
  { key: 'packing', label: '포장', sub: 'Packing' },
  { key: 'outbound', label: '출고', sub: 'Outbound' },
];

// lane keys: pcs (auto/tote), plt (auto/pallet), manual
export const LANES = [
  {
    key: 'pcs',
    label: 'PCS 자동화 라인',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,.65)',
    cells: {
      inbound: { name: 'XYZ 로봇암 · 무인지게차', icon: 'auto-in' },
      storage: { name: 'HaiPick 하이클라이머', icon: 'climber' },
      picking: { name: '하이클라이머 피킹(연계)', icon: 'climber' },
      packing: { name: '포장 자동화 솔루션', icon: 'pack-auto' },
      outbound: { name: '로봇암 · 무인지게차', icon: 'auto-out' },
    },
  },
  {
    key: 'plt',
    label: 'PLT 자동화 라인',
    color: '#60a5fa',
    glow: 'rgba(96,165,250,.65)',
    cells: {
      inbound: { name: 'XYZ 로봇암 · 무인지게차', icon: 'auto-in' },
      storage: { name: '4-Way 셔틀', icon: 'shuttle' },
      picking: { name: 'Libiao 3D 소터', icon: 'sorter' },
      packing: { name: '포장 자동화 솔루션', icon: 'pack-auto' },
      outbound: { name: '로봇암 · 무인지게차', icon: 'auto-out' },
    },
  },
  {
    key: 'manual',
    label: '매뉴얼 라인',
    color: '#c084fc',
    glow: 'rgba(192,132,252,.6)',
    cells: {
      inbound: { name: '일반 하차 (유인지게차)', icon: 'manual-in' },
      storage: { name: '일반 팔레트랙', icon: 'rack' },
      picking: { name: 'AMR & DPC (스마트글라스)', icon: 'amr' },
      packing: { name: '매뉴얼 포장', icon: 'pack-manual' },
      outbound: { name: '일반 지게차', icon: 'manual-out' },
    },
  },
];

export const TOTAL_ORDERS = 100;
export const BATCH_SIZE = 20;
export const TOTAL_BATCHES = TOTAL_ORDERS / BATCH_SIZE;
