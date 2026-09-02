// Warehouse floor plan: where each zone/equipment sits on the isometric
// grid (col = process progression, row = lane position), plus the demo's
// volume constants.

export const TOTAL_ORDERS = 1000;
export const BATCH_SIZE = 100;
export const TOTAL_BATCHES = TOTAL_ORDERS / BATCH_SIZE;

export const LANE_COLOR = {
  pcs: '#22d3ee',
  plt: '#60a5fa',
  manual: '#c084fc',
};

// ---- Inbound ----
export const INBOUND_COL = 1;
export const INBOUND_DOCKS = [
  { id: 'IN-1', row: 1, method: 'XYZ 로봇암', auto: true },
  { id: 'IN-2', row: 5, method: '무인지게차', auto: true },
  { id: 'IN-3', row: 9, method: '일반 하차', auto: false },
];

// ---- Storage (col band) subdivided into three row-bands ----
export const STORAGE_COL_RANGE = [3, 9];
export const STORAGE_BANDS = {
  climber: { rowRange: [0, 3], label: 'HaiPick 하이클라이머', sub: 'PCS/토트', lane: 'pcs' },
  shuttle: { rowRange: [4, 7], label: '4-Way 셔틀', sub: '팔레트', lane: 'plt' },
  rack: { rowRange: [8, 11], label: '일반 팔레트랙', sub: '매뉴얼', lane: 'manual' },
};
export const STORAGE_CAP_VISUAL = 260; // tiles' fill reads 100% at this count

// ---- Sort (Libiao 3D Sorter classification hub) ----
export const SORT_COL = 12;
export const SORT_ROW = 5.5;

// ---- Picking (two lanes, fed by the sort hub) ----
export const PICKING_COL_RANGE = [14, 16];
export const PICKING_LANES = {
  climber: { rowRange: [0, 5], label: '하이클라이머 피킹(연계)', lane: 'pcs' },
  amr: { rowRange: [6, 11], label: 'AMR & DPC (스마트글라스)', lane: 'plt-manual' },
};

// ---- Outbound ----
export const OUTBOUND_COL = 18;
export const OUTBOUND_DOCKS = [
  { id: 'OUT-1', row: 1, method: '로봇암' },
  { id: 'OUT-2', row: 5, method: '무인지게차' },
  { id: 'OUT-3', row: 9, method: '일반 지게차' },
];

// Visual zone bands (floor tint), one wider than the equipment's own
// col constants so each zone reads as a real region, not a sliver.
export const ZONES = [
  { key: 'inbound', label: '입고 · INBOUND', colRange: [0, 2], color: '#22d3ee' },
  { key: 'storage', label: '보관 · STORAGE', colRange: [3, 9], color: '#60a5fa' },
  { key: 'sort', label: '분류 · SORT', colRange: [10, 13], color: '#c084fc' },
  { key: 'picking', label: '피킹 · PICKING', colRange: [14, 16], color: '#34d399' },
  { key: 'outbound', label: '출고 · OUTBOUND', colRange: [17, 19], color: '#f59e0b' },
];

export function zoneOfCol(col) {
  return ZONES.find((z) => col >= z.colRange[0] && col <= z.colRange[1]) || ZONES[0];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function assignInboundLane() {
  const r = Math.random();
  if (r < 0.35) return 'pcs';
  if (r < 0.7) return 'plt';
  return 'manual';
}

export function pickDock(docks) {
  return docks[randInt(0, docks.length - 1)];
}

export function rowInBand(band) {
  return band.rowRange[0] + Math.random() * (band.rowRange[1] - band.rowRange[0]);
}

export { randInt };
