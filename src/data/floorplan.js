// Warehouse floor plan: where each zone/equipment sits on the isometric
// grid (col = process progression, row = lane position), plus the demo's
// volume constants and the WCS decision helpers that pick a route.
//
// Process order (left -> right): INBOUND -> STORAGE -> PICKING -> SORT
// (optional, bulk-pick only) -> PACKING -> OUTBOUND. Picking sits before
// sort because a bulk-picked (총량피킹) run must be sorted into individual
// orders afterward, while a discrete order-pick (오더피킹) is already
// order-level and skips sort entirely.

export const TOTAL_ORDERS = 1000;
export const BATCH_SIZE = 100;
export const TOTAL_BATCHES = TOTAL_ORDERS / BATCH_SIZE;

export const LANE_COLOR = {
  pcs: '#22d3ee',
  plt: '#60a5fa',
  manual: '#c084fc',
};

// Off-map spawn point trucks drive in from / leave toward.
export const OFFMAP_COL = -2.4;

// ---- Inbound (vehicle dock = WCS's 1st decision: which vehicle method) ----
export const INBOUND_COL = 1;
export const INBOUND_DOCKS = [
  { id: 'IN-1', row: 1, method: '로봇암', vehicle: 'robotArm', auto: true },
  { id: 'IN-2', row: 5, method: '무인지게차', vehicle: 'agv', auto: true },
  { id: 'IN-3', row: 9, method: '일반 하차', vehicle: 'manual', auto: false },
];

// ---- Storage (col band) subdivided into three row-bands ----
export const STORAGE_COL_RANGE = [4, 10];
export const STORAGE_BANDS = {
  climber: { rowRange: [0, 3], label: 'HaiPick 하이클라이머', sub: 'PCS/토트', lane: 'pcs' },
  shuttle: { rowRange: [4, 7], label: '4-Way 셔틀', sub: '팔레트', lane: 'plt' },
  rack: { rowRange: [8, 11], label: '일반 팔레트랙', sub: '박스/매뉴얼', lane: 'manual' },
};
export const STORAGE_CAP_VISUAL = 260; // tiles' fill reads 100% at this count

// ---- Picking (moved ahead of sort; 4 lanes) ----
export const PICKING_COL_RANGE = [12, 14];
// Four lanes across twelve rows means three rows of spacing, which projects
// to 90px of horizontal offset between cards. Labels are kept short so a
// card fits inside that offset and the lane below never covers the sub-line
// of the lane above.
export const PICKING_LANES = {
  climber: { rowRange: [0, 2], label: '하이클라이머', sub: 'PCS 재고', icon: 'climber' },
  amr: { rowRange: [3, 5], label: 'AMR', sub: '팔레트랙', icon: 'amr' },
  dpc: { rowRange: [6, 8], label: 'DPC 카트', sub: '팔레트랙', icon: 'dpc' },
  dps: { rowRange: [9, 11], label: 'DPS', sub: '디지털 피킹', icon: 'dps' },
};

// ---- Sort (optional - only bulk-picked/총량피킹 groups pass through) ----
export const SORT_COL = 18;
// Order-picked (오더피킹) work never touches a sorter, so it runs along a
// dedicated express strip across the top of the sort zone, tinted with the
// picking zone's green to read as "no sort - straight to packing".
export const BYPASS_ROW_MAX = 2;
export const BYPASS_ROW = 1;
export const BYPASS_COLOR = '#3bab84';
export const SORT_HUBS = {
  libiao: { row: 3, label: 'Libiao 3D 소터', icon: 'sorter' },
  das: { row: 8, label: 'DAS', sub: 'Digital Assort', icon: 'das' },
};

// ---- Packing (auto vs manual, 50/50 by order group) ----
export const PACKING_COL = 23;
export const PACKING_STATIONS = {
  auto: { row: 4, label: '자동 포장', icon: 'pack-auto' },
  manual: { row: 8, label: '매뉴얼 포장', icon: 'pack-manual' },
};

// ---- Outbound (pooled 1/3 each, shuttle-direct pallets included) ----
export const OUTBOUND_COL = 28;
export const OUTBOUND_DOCKS = [
  { id: 'OUT-1', row: 1, method: '로봇암', vehicle: 'robotArm' },
  { id: 'OUT-2', row: 5, method: '무인지게차', vehicle: 'agv' },
  { id: 'OUT-3', row: 9, method: '일반 지게차', vehicle: 'manual' },
];

// Visual zone bands (floor tint), one wider than the equipment's own
// col constants so each zone reads as a real region, not a sliver.
//
// These hues are deliberately DESATURATED versions of the token colours. The
// board carries two colour systems at once: moving order tokens (LANE_COLOR
// and the group-type colours) stay full strength because they are the thing
// you are meant to track, while everything static - floor tint, zone tags,
// equipment card borders - sits one chroma step back. Before, six saturated
// zone hues competed with four saturated token hues and nothing led the eye.
export const ZONES = [
  { key: 'inbound', label: '입고 · INBOUND', colRange: [0, 2], color: '#3aa8bd' },
  { key: 'storage', label: '보관 · STORAGE', colRange: [3, 10], color: '#5188cf' },
  { key: 'picking', label: '피킹 · PICKING', colRange: [11, 15], color: '#3bab84' },
  { key: 'sort', label: '분류 · SORT (선택)', colRange: [16, 19], color: '#9a7ad4' },
  { key: 'packing', label: '포장 · PACKING', colRange: [20, 24], color: '#cc7f45' },
  { key: 'outbound', label: '출고 · OUTBOUND', colRange: [25, 29], color: '#c9902f' },
];

export function zoneOfCol(col) {
  return ZONES.find((z) => col >= z.colRange[0] && col <= z.colRange[1]) || ZONES[0];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick(entries) {
  // entries: [[key, weight], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// ---- WCS decision #1 (inbound): classify the arriving vehicle itself ----
export function pickInboundDock() {
  return INBOUND_DOCKS[randInt(0, INBOUND_DOCKS.length - 1)];
}

// ---- WCS decision (inbound): pallet vs box cargo analysis ----
export function pickCargoType(dock) {
  if (dock.vehicle === 'manual') return 'box'; // 일반 하차 = carton by carton
  return Math.random() < 0.45 ? 'pallet' : 'box';
}

// pallet cargo always lands on the 4-way shuttle (pallet-unit storage);
// box cargo splits between the climber (PCS/tote) and general rack.
export function assignStorageBand(cargoType) {
  if (cargoType === 'pallet') return 'shuttle';
  return Math.random() < 0.5 ? 'climber' : 'rack';
}

export function pickDock(docks) {
  return docks[randInt(0, docks.length - 1)];
}

export function rowInBand(band) {
  return band.rowRange[0] + Math.random() * (band.rowRange[1] - band.rowRange[0]);
}

export function rowInLane(lane) {
  return lane.rowRange[0] + Math.random() * (lane.rowRange[1] - lane.rowRange[0]);
}

// ---- WCS decision #2 (WMS): group incoming orders into a bulk (총량피킹)
// or discrete (오더피킹) run. Few order-lines + heavy SKU overlap -> bulk
// (must sort afterward); many mixed order-lines -> discrete (skips sort).
export function decideGroupType() {
  return Math.random() < 0.42 ? 'bulk' : 'discrete';
}

// Picking-lane weights per group type. The climber always serves its own
// stored PCS product; AMR/DPC split the general-rack volume ~50/50; DPS
// only carries discrete (order-pick) traffic.
export function pickPickingLane(groupType) {
  if (groupType === 'bulk') {
    return weightedPick([
      ['climber', 0.3],
      ['amr', 0.35],
      ['dpc', 0.35],
    ]);
  }
  return weightedPick([
    ['climber', 0.25],
    ['amr', 0.25],
    ['dpc', 0.25],
    ['dps', 0.25],
  ]);
}

export function pickSortHub() {
  return Math.random() < 0.5 ? 'libiao' : 'das';
}

export function pickPackMethod() {
  return Math.random() < 0.5 ? 'auto' : 'manual';
}

export { randInt, weightedPick };
