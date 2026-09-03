// The executive walkthrough: what WCS says, and the plan it says it is
// following. Everything here is DERIVED, never random - the totals in the
// terminal, the per-station allocation, and the size of each order group
// released to the floor all come out of one plan object, so the numbers in
// the opening analysis and the numbers in every later grouping decision are
// guaranteed to agree.

export function todayLabel(d = new Date()) {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// Relative throughput of each box/pcs picking route, in orders per shift.
// The planner allocates strictly in proportion to these, which is what makes
// the allocation defensible rather than arbitrary: the fastest route gets the
// most work, and the numbers move if the capacities move.
// `flow` is fixed per station, not drawn at random: the integrated band sorts
// inside itself, the conveyor and the robot run bulk work that must be sorted
// afterwards, and the cart exists for complex orders that are already
// order-level. Which route a group takes therefore follows from where WCS put
// it, which is the point.
export const STATION_CAPACITY = [
  { key: 'climber', label: '박스/pcs 보관자동화', cap: 1850, flow: 'integrated', note: '보관·피킹·분류 통합, 분류 미경유' },
  { key: 'dps', label: 'DPS(컨베이어)', cap: 1200, flow: 'bulk', note: '고속 컨베이어, 단일 SKU 강점' },
  { key: 'amr', label: 'AMR(로봇)', cap: 500, flow: 'bulk', note: '팔레트랙 이송 자동화' },
  { key: 'dpc', label: 'DPC(카트)', cap: 300, flow: 'discrete', note: '작업자 카트, 복합 오더 대응' },
];

const TOTAL_CAP = STATION_CAPACITY.reduce((n, s) => n + s.cap, 0);

// Largest-remainder apportionment: split `total` across the stations in
// proportion to capacity and hand the rounding leftovers to the stations with
// the largest fractional parts, so the parts always sum exactly to the whole.
// A plan whose lines do not add up to its own headline is the fastest way to
// lose a room.
function apportion(total, stations) {
  const exact = stations.map((s) => (total * s.cap) / TOTAL_CAP);
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = floors.slice();
  for (let k = 0; k < left; k++) out[order[k % order.length].i] += 1;
  return stations.map((s, i) => ({ ...s, orders: out[i] }));
}

// Orders arriving as whole pallets never touch a picking station: they ship
// from pallet automation through packing. The rest is box/pcs work.
// The docks pool everything the wave produces and take a third each, so the
// split is stated here rather than left to be inferred from the floor.
export function dockSplit(total) {
  const base = Math.floor(total / 3);
  const rest = total - base * 3;
  return [
    { key: 'OUT-1', label: '로봇암 도크', orders: base + (rest > 0 ? 1 : 0) },
    { key: 'OUT-2', label: '무인지게차 도크', orders: base + (rest > 1 ? 1 : 0) },
    { key: 'OUT-3', label: '일반 지게차 도크', orders: base },
  ];
}

export function buildPlan({ id, title, total, palletShare, avgSku, note }) {
  const pallet = Math.round(total * palletShare);
  const boxPcs = total - pallet;
  const stations = apportion(boxPcs, STATION_CAPACITY);
  return {
    id,
    title,
    total,
    pallet,
    boxPcs,
    avgSku,
    note,
    stations,
    // headroom is the honest read on whether the wave fits in a shift
    capacity: TOTAL_CAP,
    utilisation: Math.round((boxPcs / TOTAL_CAP) * 100),
  };
}

// ---- Wave 1: the previous day's book, closed first thing --------------
// Fixed to the figures the walkthrough script calls out.
export const WAVE_1 = {
  id: 1,
  title: '전일 마감 오더',
  total: 2000,
  pallet: 738,
  boxPcs: 1262,
  avgSku: 3.7,
  note: '오더라인 복합, 건별 처리 비중 높음',
  capacity: TOTAL_CAP,
  utilisation: Math.round((1262 / TOTAL_CAP) * 100),
  stations: [
    { key: 'dps', label: 'DPS(컨베이어)', cap: 1200, orders: 700, flow: 'bulk', note: '고속 컨베이어, 단일 SKU 강점' },
    { key: 'dpc', label: 'DPC(카트)', cap: 300, orders: 562, flow: 'discrete', note: '작업자 카트, 복합 오더 대응' },
  ],
};

// ---- Wave 2: the afternoon book -------------------------------------
// Afternoon orders repeat far more (avg 2.4 lines against the morning's 3.7),
// so a much larger share is bulk-pickable and the integrated band, which
// needs no sorter afterwards, is worth loading first. The apportionment does
// the rest.
export const WAVE_2 = buildPlan({
  id: 2,
  title: '오후 마감 오더',
  total: 5000,
  palletShare: 0.23,
  avgSku: 2.4,
  note: '오더라인 단순, 동일 SKU 반복 다수로 묶음 처리 유리',
});

export const WAVES = [WAVE_1, WAVE_2];

// Terminal read-out for a wave, built from that wave's own plan so the lines
// can never drift from what the floor is about to do.
export function planTerminalLines(plan) {
  const staff = staffPlan(plan);
  const chosen = staff.picking.length;
  const pool = STATION_CAPACITY.length + 1; // the four picking routes plus pallet direct

  const lines = [
    { text: '접수 오더 수량 확인', value: `${plan.total.toLocaleString()}건`, ok: true },
    { text: '평균 오더라인(SKU) 분석', value: `${plan.avgSku}`, ok: true },
    { text: '오더 유형 분류', value: plan.note, ok: true },
    { text: '가용 설비 조회 및 선택', value: `${pool}종 중 ${chosen}종`, ok: true },
    { text: '설비 가용 능력 대비 배분', value: `가동률 ${plan.utilisation}%`, ok: true },
  ];

  const row = (r, extra) => ({
    text: `   · ${r.label}`,
    value: `${r.orders.toLocaleString()}건 · ${extra}`,
    indent: true,
    dim: true,
  });

  lines.push({ text: '보관·피킹 설비 배정', value: `${staff.waves} wave 편성`, ok: true });
  for (const r of staff.picking) {
    lines.push(row(r, `${r.waves} wave · ${r.people}명${r.robots ? ` · 로봇 ${r.robots}대` : ''}`));
  }

  lines.push({ text: '분류 설비 배정', value: `${staff.sorting.length}종`, ok: true });
  for (const r of staff.sorting) lines.push(row(r, `${r.people}명 · ${r.rule}`));

  lines.push({ text: '포장 라인 배정', value: '2종', ok: true });
  for (const r of staff.packing) lines.push(row(r, `${r.people}명`));

  const docks = dockSplit(plan.total);
  lines.push({ text: '출고 도크 배차', value: '3개 도크 균등', ok: true });
  for (const d of docks) {
    lines.push({ text: `   · ${d.label}`, value: `${d.orders.toLocaleString()}건`, indent: true, dim: true });
  }

  lines.push(
    { text: '검수 자동화용 스마트글라스 지시', value: `${staff.glassesAt.length}개 구역`, ok: true },
    { text: '총 투입 인원 확정', value: `${staff.totalPeople}명`, ok: true },
    { text: '출고 마감 시간 대비 여유', value: plan.utilisation >= 95 ? '타이트' : '확보', ok: true },
    { text: '인원 배정 및 오더 지시 완료', value: '모니터링 모드 전환', ok: true },
  );
  return lines;
}

// What 최적 결정 shows for a wave. The strategy is one choice, but its
// OUTCOME is a simultaneous assignment across every route - showing a single
// confirmation chip made it look like WCS had picked one machine and sent the
// whole book there.
export function planAllocationChips(plan) {
  return [
    { key: 'shuttle', label: '팔레트 보관자동화', orders: plan.pallet },
    ...plan.stations.map((st) => ({ key: st.key, label: st.label, orders: st.orders })),
  ];
}

// ---- Phase 1: the single inbound load --------------------------------
export function inboundTerminalLines() {
  return [
    { text: '입고 오더 수신', value: '1건', ok: true },
    { text: '물량 확인', value: '팔레트 24 · 박스 312', ok: true },
    { text: '팔레트 상태 판독', value: '적재 정상', ok: true },
    { text: 'SKU 상태 조회', value: '신규 4 · 기존 38', ok: true },
    { text: '당일 출고 대상 여부', value: '해당 없음', ok: true },
    { text: '품질검사 대상 여부', value: '표본 2건', ok: true },
    { text: '입고 방식 후보 산출', value: '3개', ok: true },
  ];
}

export const INBOUND_CANDIDATES = [
  { key: 'manual', label: '일반 지게차', note: '가용, 처리 속도 낮음' },
  { key: 'agv', label: '무인지게차', note: '가용, 팔레트 전용' },
  { key: 'robotArm', label: '로봇암', note: '가용, 혼적 박스 처리 가능', chosen: true },
];

// ---- Incident scripts -------------------------------------------------
// Every trigger now opens the same way the scheduled work does: WCS says what
// it has seen, shows its working in the terminal, commits to a decision, and
// afterwards says what it learned. The shape is identical across all three so
// the room learns to read it once.
export const INCIDENT_SCRIPTS = {
  bottleneck: {
    tone: 'danger',
    opening: '분류 구간에 병목이 감지되었습니다. 분석을 시작합니다',
    terminalTitle: '분류 병목 분석',
    lines: [
      { text: 'AGV(로봇) 투입 대비 처리량', value: '초과', ok: true },
      { text: '대기열 증가 추세 판정', value: '악화', ok: true },
      { text: 'DAS(컨베이어) 여유 용량 조회', value: '확보', ok: true },
      { text: '경로 변경 시 예상 지연', value: '단축', ok: true },
      { text: '우회 경로 산출', value: '완료', ok: true },
    ],
    learned: '병목 발생 건을 학습하여 물량 배부 기준에 반영하였습니다. 동일 조건에서는 사전에 분산 배정합니다',
    options: [
      { key: 'libiao', label: 'AGV(로봇)', note: '현재 과부하, 대기열 증가' },
      { key: 'das', label: 'DAS(컨베이어)', note: '여유 용량 확보', chosen: true },
      { key: 'hold', label: '투입 보류', note: '출고 마감 지연 발생' },
    ],
  },
  urgent: {
    tone: 'urgent',
    opening: '긴급 오더가 발생하였습니다. 분석을 시작합니다',
    terminalTitle: '긴급 오더 분석',
    lines: [
      { text: '출고 마감 잔여 시간 확인', value: '임박', ok: true },
      { text: '해당 SKU 재고 위치 조회', value: '박스/pcs 보관자동화', ok: true },
      { text: '보관 단계 생략 가능 여부', value: '가능', ok: true },
      { text: '최단 경로 산출', value: '하이패스', ok: true },
    ],
    learned: '긴급 오더 패턴을 학습하여 해당 SKU를 상시 하이패스 대상으로 등록하였습니다',
    options: [
      { key: 'climber', label: '박스/pcs 보관자동화', note: '재고 보유, 보관 단계 생략 가능', chosen: true },
      { key: 'dps', label: 'DPS(컨베이어)', note: '가용, 대기열 존재' },
      { key: 'dpc', label: 'DPC(카트)', note: '가용, 처리 속도 낮음' },
    ],
  },
  failure: {
    tone: 'danger',
    opening: '출고 설비 이상이 감지되었습니다. 분석을 시작합니다',
    terminalTitle: '설비 이상 분석',
    lines: [
      { text: '설비 응답 상태 점검', value: '무응답', ok: true },
      { text: '해당 도크 배정 물량 조회', value: '고립', ok: true },
      { text: '대체 도크 가용 여부', value: '확보', ok: true },
      { text: '재배정 시 출고 지연', value: '최소', ok: true },
    ],
    learned: '설비 고장 정보를 학습하여 설비업체에 예지정비를 요청하였습니다. 동일 부품군은 사전 교체 대상으로 등록됩니다',
    // the chosen dock is filled in at fire time, since which one failed
    // decides which alternates are even on the table
    options: null,
  },
};


// ---- Releasing a plan onto the floor ---------------------------------
// A wave is not dumped on the floor in one lump: it leaves as order groups,
// and each group's size and destination are read straight off the plan. That
// is what keeps a grouping cinematic's "OG-3, 175건, DPS(컨베이어) 배정"
// consistent with the totals the opening analysis announced, instead of the
// two telling the room different numbers.
const ORDERS_PER_GROUP = 175;
const ORDERS_PER_PALLET_BLOCK = 260;

function slice(total, per) {
  const n = Math.max(1, Math.round(total / per));
  const base = Math.floor(total / n);
  const out = [];
  let left = total;
  for (let i = 0; i < n; i++) {
    const size = i === n - 1 ? left : base;
    left -= size;
    out.push(size);
  }
  return out;
}

export function buildReleases(plan) {
  const perStation = plan.stations.map((st) =>
    slice(st.orders, ORDERS_PER_GROUP).map((size) => ({
      kind: 'pick',
      lane: st.key,
      label: st.label,
      flow: st.flow,
      size,
    })),
  );
  perStation.push(
    slice(plan.pallet, ORDERS_PER_PALLET_BLOCK).map((size) => ({
      kind: 'pallet',
      lane: 'shuttle',
      label: '팔레트 보관자동화',
      flow: 'direct',
      size,
    })),
  );

  // Round-robin across the routes so every part of the floor is working at
  // once. Running one station dry before starting the next would be a
  // correct plan and a dead demo.
  const out = [];
  for (let i = 0; ; i++) {
    let added = false;
    for (const queue of perStation) {
      if (i < queue.length) {
        out.push(queue[i]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out.map((r, i) => ({ ...r, seq: i + 1 }));
}


// ---- The planning decision itself ------------------------------------
// A wave is not just analysed, it is DECIDED: three ways to spread a book
// across the floor, of which capacity-proportional is the one that neither
// starves the fast routes nor drowns the slow ones. Naming the two rejected
// strategies is what makes the resulting numbers read as a judgement rather
// than as an arbitrary split.
export const ALLOCATION_CANDIDATES = [
  { key: 'even', label: '설비 균등 배분', note: '저속 설비에서 병목 발생' },
  { key: 'single', label: '단일 설비 집중', note: '처리량 한계 초과' },
  { key: 'capacity', label: '가용 능력 비례 배분', note: '전 설비 가동률 균형', chosen: true },
];

export function planDecisionLines(plan) {
  const staff = staffPlan(plan);
  return [
    `${plan.title} ${plan.total.toLocaleString()}건 일괄 접수, 평균 오더라인 ${plan.avgSku} 확인`,
    `배분 방식 3종 비교, 설비별 가용 능력과 오더 유형 대조`,
    `가용 능력 비례 배분 확정. ${staff.picking.length}종 설비 ${staff.waves} wave 편성, 총 ${staff.totalPeople}명 투입 · 스마트글라스 ${staff.glassesAt.length}개 구역 지시`,
  ];
}

// ---- One order group leaving for the floor ---------------------------
export function releaseTerminalLines(plan, rel, remaining) {
  return [
    { text: `${rel.label} 배정분 조회`, value: `${plan.laneTotal(rel.lane).toLocaleString()}건`, ok: true },
    { text: '설비 큐 적재 상태 확인', value: '여유', ok: true },
    { text: '선행 그룹 처리 진척 확인', value: '정상', ok: true },
    { text: '그룹 편성 단위 산정', value: `${rel.size.toLocaleString()}건`, ok: true },
    { text: '잔여 미편성 물량', value: `${remaining.toLocaleString()}건`, ok: true },
  ];
}

// ---- Labour ----------------------------------------------------------
// What each route actually costs in people. These are the rules an operations
// planner would state out loud, so they are written as rules and applied,
// rather than as numbers typed into a script:
//
//   박스/pcs 보관자동화  무인 (관제 1명)
//   팔레트 보관자동화    무인 (관제 1명)
//   AMR(로봇)          1대 시간당 30건, 로봇 2대당 작업자 1명
//   DPS(컨베이어)       라인 고정 10명
//   DPC(카트)          작업자 1인 시간당 30건
//   AGV(로봇) 분류      주문 100건당 3명
//   DAS(컨베이어) 분류   기본 5명, 물량이 많으면 10명
//   수동 포장           작업자 1인 시간당 40건
//   자동 포장           무인 (관제 1명)
//
// Anywhere a person is assigned,検수 자동화용 스마트글라스가 함께 지시된다.
export const SHIFT_HOURS = 4;
const AMR_PER_ROBOT_HOUR = 30;
const AMR_ROBOTS_PER_WORKER = 2;
const DPS_LINE_CREW = 10;
const DPC_PER_WORKER_HOUR = 30;
const AGV_WORKERS_PER_100 = 3;
const DAS_BASE_CREW = 5;
const DAS_SURGE_CREW = 10;
const DAS_SURGE_AT = 1000;
const MANUAL_PACK_PER_WORKER_HOUR = 40;
const AUTO_PACK_SHARE = 0.55;

// Bulk work has to be sorted, and the two sorters differ in throughput, so
// the split between them follows their capacity rather than a coin toss.
const SORT_CAPACITY = [
  { key: 'libiao', label: 'AGV(로봇)', cap: 1200 },
  { key: 'das', label: 'DAS(컨베이어)', cap: 800 },
];

const ceilDiv = (n, d) => (d > 0 ? Math.ceil(n / d) : 0);

function stationLabour(st) {
  if (st.key === 'amr') {
    const robots = ceilDiv(st.orders, AMR_PER_ROBOT_HOUR * SHIFT_HOURS);
    return { robots, people: ceilDiv(robots, AMR_ROBOTS_PER_WORKER), rule: `로봇 ${robots}대 · 2대당 1명` };
  }
  if (st.key === 'dps') return { people: DPS_LINE_CREW, rule: '라인 고정 배치' };
  if (st.key === 'dpc') {
    return { people: ceilDiv(st.orders, DPC_PER_WORKER_HOUR * SHIFT_HOURS), rule: '1인 시간당 30건' };
  }
  return { people: 1, rule: '무인 · 관제' };
}

export function staffPlan(plan) {
  const releases = buildReleases(plan);
  const wavesOf = (lane) => releases.filter((r) => r.lane === lane).length;

  const picking = plan.stations.map((st) => ({
    key: st.key,
    label: st.label,
    orders: st.orders,
    waves: wavesOf(st.key),
    ...stationLabour(st),
  }));
  picking.unshift({
    key: 'shuttle',
    label: '팔레트 보관자동화',
    orders: plan.pallet,
    waves: wavesOf('shuttle'),
    people: 1,
    rule: '무인 · 관제',
  });

  // sorting: only bulk-flow routes pass through a sorter
  const bulk = plan.stations.filter((st) => st.flow === 'bulk').reduce((n, st) => n + st.orders, 0);
  const capTotal = SORT_CAPACITY.reduce((n, c) => n + c.cap, 0);
  let assigned = 0;
  const sorting = SORT_CAPACITY.map((c, i) => {
    const orders = i === SORT_CAPACITY.length - 1 ? bulk - assigned : Math.round((bulk * c.cap) / capTotal);
    assigned += orders;
    const people =
      c.key === 'libiao'
        ? ceilDiv(orders, 100) * AGV_WORKERS_PER_100
        : orders > DAS_SURGE_AT
          ? DAS_SURGE_CREW
          : DAS_BASE_CREW;
    const rule = c.key === 'libiao' ? '주문 100건당 3명' : orders > DAS_SURGE_AT ? '증량 고정 10명' : '기본 고정 5명';
    return { key: c.key, label: c.label, orders, people, rule };
  }).filter((r) => r.orders > 0);

  const autoPack = Math.round(plan.total * AUTO_PACK_SHARE);
  const manualPack = plan.total - autoPack;
  const packing = [
    { key: 'auto', label: '자동 포장', orders: autoPack, people: 1, rule: '무인 · 관제' },
    {
      key: 'manual',
      label: '수동 포장',
      orders: manualPack,
      people: ceilDiv(manualPack, MANUAL_PACK_PER_WORKER_HOUR * SHIFT_HOURS),
      rule: '1인 시간당 40건',
    },
  ];

  const all = [...picking, ...sorting, ...packing];
  return {
    picking,
    sorting,
    packing,
    waves: releases.length,
    totalPeople: all.reduce((n, r) => n + r.people, 0),
    // smart glasses go wherever a person is actually picking or sorting
    glassesAt: [...picking, ...sorting].filter((r) => r.rule !== '무인 · 관제').map((r) => r.label),
  };
}
