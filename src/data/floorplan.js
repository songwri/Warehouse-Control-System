// Warehouse floor plan: where each zone/equipment sits on the isometric
// grid (col = process progression, row = lane position), plus the demo's
// volume constants and the WCS decision helpers that pick a route.
//
// Process order (left -> right): 입고 -> 보관 -> 피킹 -> 분류 (선택) ->
// 포장 -> 출고. Picking sits before sort because a bulk-picked run must be
// sorted into individual orders afterward, while a discrete order-pick is
// already order-level and skips sort entirely.

// The day is two scripted books: the previous day's 2,000 and the afternoon's
// 5,000. This was still 2,000 after the second wave was added, which silently
// capped the completed counter and made the closing message report a third of
// the work as the whole day.
export const TOTAL_ORDERS = 7000;
export const BATCH_SIZE = 100;
export const TOTAL_BATCHES = TOTAL_ORDERS / BATCH_SIZE;

export const LANE_COLOR = {
  pcs: '#22d3ee',
  plt: '#60a5fa',
  manual: '#c084fc',
};

// Off-map spawn point trucks drive in from / leave toward.
export const OFFMAP_COL = -2.4;
// Where a loaded order leaves the map. Completed work used to simply stop
// existing on the dock tile; now it drives off the right edge, so "shipped"
// is something the room watches happen rather than infers from a counter.
export const OFFMAP_OUT_COL = 32.5;

// ---- Inbound (vehicle dock = WCS's 1st decision: which vehicle method) ----
export const INBOUND_COL = 1;
export const INBOUND_DOCKS = [
  { id: 'IN-1', row: 1, method: '로봇암', vehicle: 'robotArm', auto: true },
  { id: 'IN-2', row: 5, method: '무인지게차', vehicle: 'agv', auto: true },
  { id: 'IN-3', row: 9, method: '일반 지게차', vehicle: 'manual', auto: false },
];

// Bracket captions painted on the floor so the automated docks read as one
// area and the manual dock as another, without needing a legend.
export const DOCK_GROUPS = [
  { key: 'in-auto', label: '[ 입고 자동화 ]', col: INBOUND_COL, rowRange: [1, 5], side: 'inbound' },
  { key: 'in-manual', label: '[ 일반 입고 ]', col: INBOUND_COL, rowRange: [9, 9], side: 'inbound' },
];

// ---- Storage ----
// The climber band is special: it stores, picks and sorts in one place, so
// its work never touches another machine and leaves straight for packing.
// It therefore owns a single continuous floor colour all the way across the
// storage, picking and sort columns rather than being cut into three zones.
export const STORAGE_COL_RANGE = [4, 10];
export const INTEGRATED_ROWS = [0, 3];
export const INTEGRATED_COLS = [3, 19];
// The integrated band cuts horizontally across storage, picking and sort, so
// it has to separate from all three at once: a teal that is 66 from storage's
// violet, 36 from picking's green and 124 from sort's magenta.
export const INTEGRATED_COLOR = '#2fb0a8';
export const STORAGE_BANDS = {
  climber: { rowRange: [0, 3], label: '박스/pcs 보관자동화', sub: '보관 · 피킹 · 분류 통합', lane: 'pcs' },
  shuttle: { rowRange: [4, 7], label: '팔레트 보관자동화', sub: '팔레트 단위', lane: 'plt' },
  rack: { rowRange: [8, 11], label: '일반 팔레트랙', sub: '박스 · 매뉴얼', lane: 'manual' },
};
export const STORAGE_CAP_VISUAL = 260; // tiles' fill reads 100% at this count

// ---- Picking ----
// The climber has no separate picking station any more: it picks its own
// stock inside the integrated band above.
export const PICKING_COL_RANGE = [12, 14];
export const PICKING_LANES = {
  amr: { rowRange: [4, 6], label: 'AMR(로봇)', sub: '팔레트랙', icon: 'amr' },
  dpc: { rowRange: [7, 9], label: 'DPC(카트)', sub: '팔레트랙', icon: 'dpc' },
  dps: { rowRange: [10, 11], label: 'DPS(컨베이어)', sub: '고속 처리', icon: 'dps' },
};

// The integrated band picks its own stock where it sits, so it has no
// station in the picking column. It still needs a name and a row range for
// routing and callouts, so it gets a descriptor here. `laneInfo` is what the
// engine should ask, never PICKING_LANES directly: `climber` is a valid lane
// everywhere else in the model and looking it up in PICKING_LANES returns
// undefined.
export const INTEGRATED_LANE = {
  rowRange: INTEGRATED_ROWS,
  label: '박스/pcs 보관자동화',
  sub: '보관 · 피킹 · 분류 통합',
  icon: 'climber',
};

export function laneInfo(key) {
  return PICKING_LANES[key] || INTEGRATED_LANE;
}

// ---- Sort (optional - only bulk-picked groups pass through) ----
export const SORT_COL = 18;
// Discrete (order-pick) work never touches a sorter, so it runs along a
// dedicated express row just below the integrated band.
export const BYPASS_ROW = 4;
export const BYPASS_COLOR = '#3bab84';
export const SORT_HUBS = {
  libiao: { row: 6, label: 'AGV(로봇)', icon: 'sorter' },
  das: { row: 10, label: 'DAS(컨베이어)', icon: 'das' },
};

// ---- Packing (auto vs manual, 50/50 by order group) ----
export const PACKING_COL = 23;
export const PACKING_STATIONS = {
  auto: { row: 4, label: '자동 포장', icon: 'pack-auto' },
  manual: { row: 9, label: '수동 포장', icon: 'pack-manual' },
};

// ---- Outbound (pooled 1/3 each, shuttle-direct pallets included) ----
export const OUTBOUND_COL = 28;
export const OUTBOUND_DOCKS = [
  { id: 'OUT-1', row: 1, method: '로봇암', vehicle: 'robotArm' },
  { id: 'OUT-2', row: 5, method: '무인지게차', vehicle: 'agv' },
  { id: 'OUT-3', row: 9, method: '일반 지게차', vehicle: 'manual' },
];

DOCK_GROUPS.push(
  { key: 'out-auto', label: '[ 출고 자동화 ]', col: OUTBOUND_COL, rowRange: [1, 5], side: 'outbound' },
  { key: 'out-manual', label: '[ 일반 출고 ]', col: OUTBOUND_COL, rowRange: [9, 9], side: 'outbound' },
);

// Visual zone bands (floor tint). The board is read left to right, so what
// matters is not that six hues look nice together but that each one is
// unmistakable against the ONE zone it touches. The ramp is therefore chosen
// for adjacent separation, taking a large step at every boundary rather than
// walking around the wheel:
//   입고 cyan 188 -> 보관 violet 242  (54)
//   보관 violet 242 -> 피킹 green 140 (102)
//   피킹 green 140 -> 분류 magenta 300 (160)
//   분류 magenta 300 -> 포장 orange 14 (74)
//   포장 orange 14 -> 출고 yellow-green 65 (51, plus a full step of lightness)
// The last pair sat 20 degrees apart as an orange beside a gold and read as
// one continuous band of floor.
export const ZONES = [
  { key: 'inbound', label: '입고', colRange: [0, 2], color: '#2bb0c4' },
  { key: 'storage', label: '보관', colRange: [3, 10], color: '#6b6ee0' },
  { key: 'picking', label: '피킹', colRange: [11, 15], color: '#43b06a' },
  { key: 'sort', label: '분류', colRange: [16, 19], color: '#c25ec2' },
  { key: 'packing', label: '포장', colRange: [20, 24], color: '#c4552e' },
  { key: 'outbound', label: '출고', colRange: [25, 29], color: '#b8c247' },
];

export function zoneOfCol(col) {
  return ZONES.find((z) => col >= z.colRange[0] && col <= z.colRange[1]) || ZONES[0];
}

// True for the storage/picking/sort tiles the climber band owns end to end.
export function inIntegratedBand(col, row) {
  return (
    row >= INTEGRATED_ROWS[0] && row <= INTEGRATED_ROWS[1] &&
    col >= INTEGRATED_COLS[0] && col <= INTEGRATED_COLS[1]
  );
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick(entries) {
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
  if (dock.vehicle === 'manual') return 'box';
  return Math.random() < 0.45 ? 'pallet' : 'box';
}

// pallet cargo always lands on the pallet automation (pallet-unit storage);
// box cargo splits between the integrated box/pcs band and the general rack.
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

// ---- WCS decision #2 (WMS): group orders into a bulk or discrete run ----
export function decideGroupType() {
  return Math.random() < 0.42 ? 'bulk' : 'discrete';
}

// Picking-lane weights per group type. `climber` is returned for work the
// integrated band handles itself; it has no picking station of its own.
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
    ['dpc', 0.2],
    ['dps', 0.3],
  ]);
}

export function pickSortHub() {
  return Math.random() < 0.5 ? 'libiao' : 'das';
}

export function pickPackMethod() {
  return Math.random() < 0.5 ? 'auto' : 'manual';
}

export { randInt, weightedPick };
