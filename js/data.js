// WCS Mockup Simulator - static configuration & reference data
// All coordinates are in SVG user-space units (viewBox 0 0 1600 900).

const LAYOUT = {
  viewBox: { w: 1600, h: 900 },

  // Inbound truck docks
  inboundAutoDocks: [
    { id: 'A-1', x: 30, y: 90 },
    { id: 'A-2', x: 30, y: 160 },
    { id: 'A-3', x: 30, y: 230 },
  ],
  inboundGeneralDocks: [
    { id: 'B-1', x: 30, y: 340 },
    { id: 'B-2', x: 30, y: 410 },
    { id: 'B-3', x: 30, y: 480 },
  ],

  // Robot-arm unloading cell (belongs to auto docks)
  robotArm: { x: 170, y: 160 },

  // Inbound classification hub (decides pallet vs PCS)
  inboundHub: { x: 320, y: 300 },

  // 4-Way Shuttle + Pallet Rack storage zone
  shuttleZone: {
    x: 430, y: 40, w: 560, h: 300,
    label: '4-Way Shuttle · 팔레트랙 존',
    rows: 4, cols: 12,
    cellW: 40, cellH: 56,
  },

  // HAIPICK Climber storage zone (vertical PCS storage)
  climberZone: {
    x: 1030, y: 40, w: 220, h: 300,
    label: 'HAIPICK Climber 존 (PCS)',
    levels: 6, cols: 4,
    cellW: 46, cellH: 42,
  },

  // Order intake hub (analyzes incoming e-commerce orders)
  orderHub: { x: 700, y: 430 },

  // Picking method lanes
  pickLanes: {
    haipick: { x: 1030, y: 430, label: 'HAIPICK 피킹' },
    cart: { x: 500, y: 560, label: '피킹카트' },
    amr: { x: 500, y: 660, label: 'AMR 피킹' },
  },

  // Libiao 3D Sorter - PCS induction sorting for multi-line order consolidation
  sorterZone: {
    x: 850, y: 600, w: 200, h: 140,
    label: 'Libiao 3D Sorter · 오더별 자동분류',
    rows: 3, cols: 6,
    cellW: 30, cellH: 32,
  },

  // Packing / staging
  packStation: { x: 1230, y: 560, label: '패킹/검수 스테이션' },

  // Outbound docks (auto-assigned)
  outboundDocks: [
    { id: 'C-1', x: 1560, y: 480 },
    { id: 'C-2', x: 1560, y: 560 },
    { id: 'C-3', x: 1560, y: 640 },
    { id: 'C-4', x: 1560, y: 720 },
  ],
};

// SKU master pool used to fabricate plausible inbound/outbound data.
// tier = 회전율(피킹 빈도) 등급 A(고빈도) > B(중빈도) > C(저빈도), used by the
// outbound picking-method rules.
const SKU_POOL = [
  { sku: 'SKU-88213', name: '무선 이어폰', unit: 'PCS', category: '가전', tier: 'A' },
  { sku: 'SKU-40291', name: '텀블러 세트', unit: 'PCS', category: '생활', tier: 'B' },
  { sku: 'SKU-77120', name: '생수 24입', unit: 'PLT', category: '식품', tier: 'A' },
  { sku: 'SKU-15542', name: '즉석밥 박스', unit: 'PLT', category: '식품', tier: 'B' },
  { sku: 'SKU-93087', name: '섬유유연제', unit: 'PLT', category: '생활', tier: 'B' },
  { sku: 'SKU-22765', name: '블루투스 스피커', unit: 'PCS', category: '가전', tier: 'A' },
  { sku: 'SKU-61048', name: '반려동물 사료', unit: 'PLT', category: '펫', tier: 'C' },
  { sku: 'SKU-30456', name: '핸드크림', unit: 'PCS', category: '뷰티', tier: 'B' },
  { sku: 'SKU-58821', name: '커피캡슐 박스', unit: 'PLT', category: '식품', tier: 'A' },
  { sku: 'SKU-70933', name: '스마트워치', unit: 'PCS', category: '가전', tier: 'C' },
  { sku: 'SKU-19204', name: '주방세제', unit: 'PLT', category: '생활', tier: 'C' },
  { sku: 'SKU-84410', name: '보조배터리', unit: 'PCS', category: '가전', tier: 'B' },
];

const CARRIERS = ['CJ대한통운', '한진택배', '롯데글로벌로지스', '로젠택배', '쿠팡물류'];

// ---------------------------------------------------------------------------
// Facility assignment standards (mockup rule set, grounded in real equipment
// specs). These constants drive both the engine's decision logs and the
// "설비 기준" reference page, so the two stay in sync.
// ---------------------------------------------------------------------------

// Robotic unloader (robot-arm) eligibility - carton must fit these bounds to
// qualify for the auto-receiving dock; anything outside goes to the general
// forklift dock instead.
const INBOUND_BOX_SPEC = {
  minL: 200, maxL: 560, // mm
  minW: 150, maxW: 400,
  minH: 100, maxH: 350,
  maxWeightKg: 25,
};

const STANDARD_PALLET_MM = '1,100×1,100'; // KS T-11 표준 파렛트

// Equipment reference data: shared by hover tooltips on the map and the
// "설비 기준" page. Sourced from published specs for the real HAIPICK Climb
// and Libiao 3D t-sort products (see README for links); other entries use
// representative industry figures for the equipment class.
const EQUIPMENT = {
  'robot-arm': {
    name: '로봇팔 자동하차기',
    category: '입고 · Robotic Unloader',
    desc: '입고 트럭에 실린 혼합 카톤을 로봇팔이 직접 집어 자동으로 하차하는 설비입니다. 바코드가 상면에 노출된 규격 카톤을 대상으로 완전 무인 하차를 수행합니다.',
    specs: [
      `처리 규격: ${INBOUND_BOX_SPEC.minL}~${INBOUND_BOX_SPEC.maxL} × ${INBOUND_BOX_SPEC.minW}~${INBOUND_BOX_SPEC.maxW} × ${INBOUND_BOX_SPEC.minH}~${INBOUND_BOX_SPEC.maxH}mm`,
      `허용 중량: 박스당 ≤ ${INBOUND_BOX_SPEC.maxWeightKg}kg`,
      '적재 유형: 혼합 SKU 카톤 (단일 팔레트 랩핑 화물 제외)',
    ],
    criteria: [
      '박스 규격·중량이 기준 이내 & 혼합카톤 적재 → 자동입고장치존 배정',
      '기준 초과 또는 완제품 팔레트 화물 → 일반 하차장(지게차)으로 자동 전환',
    ],
  },
  shuttle: {
    name: '4-Way Shuttle & 팔레트랙',
    category: '보관 · Pallet ASRS',
    desc: '셔틀 로봇이 랙 내부를 전·후·좌·우 4방향으로 자유롭게 이동하며 팔레트를 입출고하는 고밀도 자동 보관 시스템입니다.',
    specs: [
      '팔레트 하중: 1,500~2,000kg',
      '주행 속도: 최대 72m/min',
      '랙 구조: 다단·다열 초고밀도 보관 (통로 최소화)',
    ],
    criteria: [
      '완제품 팔레트(PLT) 단위 랩핑 화물 보관',
      '팔레트 단위 통짜 출고 오더는 랙 → 출고도크로 직송(피킹 생략)',
    ],
  },
  climber: {
    name: 'HAIPICK Climber',
    category: '보관·피킹 · Goods-to-Person ASRS',
    desc: '클라이밍 로봇이 랙을 수직으로 직접 등반해 토트를 피킹존까지 운반하는 goods-to-person 자동창고입니다. 카톤·낱개를 트레이 디캔팅 없이 그대로 보관·출고할 수 있습니다.',
    specs: [
      '보관 밀도: 1,000㎡당 최대 45,000토트, 랙 높이 최대 12m',
      '통로 폭: 900mm (초협소 통로)',
      '처리량: 시간당 4,000토트 · 오더 접수 후 약 2분 내 워크스테이션 도착',
    ],
    criteria: [
      'PCS(낱개) 단위 SKU, 회전율 A/B등급 우선 보관',
      '완전자동 goods-to-person 피킹이라 스마트글라스 불필요',
    ],
  },
  sorter: {
    name: 'Libiao 3D Sorter',
    category: '출고 · 3D Put Sorter',
    desc: '인덕션에 투입된 PCS 상품을 3D 소팅로봇이 오더별 슈트로 자동 분류하는 설비입니다. 여러 존/시점에 걸쳐 피킹된 다품목 오더를 하나로 합포장(컨솔리데이션)할 때 사용합니다.',
    specs: [
      '분류 처리량: 모듈당 시간당 3,000픽',
      '최대 목적지(슈트) 수: 최대 3,840개',
      '인덕션 처리량: 스테이션당 시간당 최대 3,700건',
    ],
    criteria: [
      '오더 라인수 2개 이상(다품목) 오더만 투입',
      '단일 SKU 오더는 Sorter를 생략하고 바로 패킹',
    ],
  },
  cart: {
    name: '피킹카트',
    category: '피킹 · Cart Picking',
    desc: '작업자가 도보로 이동하며 팔레트랙에서 낱개·케이스 단위로 직접 피킹하는 수동 카트입니다. 사람과 시스템이 함께 작업하는 이기종 협업이라 스마트글라스 오토검수를 병행 배정합니다.',
    specs: [
      '동시 적재: 멀티오더 토트 최대 4~6개',
      '이동 방식: 도보 인력 피킹 (WMS 경로 안내)',
    ],
    criteria: [
      '팔레트랙 보관 SKU & 오더 라인수 3개 이하',
      '회전율 B/C등급(중·저빈도) 오더 우선 배정 + 스마트글라스',
    ],
  },
  amr: {
    name: 'AMR 피킹 로봇',
    category: '피킹 · Autonomous Mobile Robot',
    desc: '작업자를 따라다니거나 유도하며 여러 랙 구간을 순회하는 자율주행 피킹 보조 로봇입니다. 사람과 로봇이 함께 움직이는 이기종 협업이라 스마트글라스 오토검수를 병행 배정합니다.',
    specs: [
      '자율주행: 라이다 기반 SLAM 내비게이션',
      '동시 처리: 다중 오더 배치피킹 지원',
    ],
    criteria: [
      '팔레트랙 보관 SKU & 오더 라인수 4개 이상 또는 회전율 A등급(고빈도)',
      '구역 간 이동거리가 긴 배치피킹에 우선 배정 + 스마트글라스',
    ],
  },
  'pack-station': {
    name: '패킹 / 오토검수 스테이션',
    category: '출고 · Pack & Verify',
    desc: '피킹 완료된 상품을 스마트글라스 스캔 데이터와 대조해 자동 검수한 뒤 포장하고, 실시간 가용 도크를 탐색해 출고도크를 자동배정하는 최종 스테이션입니다.',
    specs: [
      '검수 방식: 스마트글라스 AR 스캔 대조',
      '도크 배정: 실시간 가용 도크 자동탐색',
    ],
    criteria: [
      '스마트글라스 배정 오더 → 검수 로그 자동대조 후 패킹',
      'HAIPICK·팔레트 직송 오더 → 설비 자체 검증으로 대체',
    ],
  },
};

// Ordered rule summaries for the "설비 기준" reference page.
const ROUTING_RULES = {
  inboundDock: [
    `카톤 규격 ${INBOUND_BOX_SPEC.minL}~${INBOUND_BOX_SPEC.maxL}×${INBOUND_BOX_SPEC.minW}~${INBOUND_BOX_SPEC.maxW}×${INBOUND_BOX_SPEC.minH}~${INBOUND_BOX_SPEC.maxH}mm, ≤${INBOUND_BOX_SPEC.maxWeightKg}kg & 혼합SKU 적재 → 자동입고장치존(로봇팔)`,
    `표준 파렛트(${STANDARD_PALLET_MM}mm) 랩핑 완제품, 규격 초과 화물 → 일반 하차장(지게차)`,
  ],
  storage: [
    '팔레트 단위(PLT) 완제품 → 4-Way Shuttle & 팔레트랙',
    'PCS(낱개) 단위, 회전율 A/B등급 우선 → HAIPICK Climber',
  ],
  picking: [
    '오더 수량이 팔레트 단위 통짜 출고 → 피킹 생략, 랙 → 도크 직송',
    'HAIPICK Climber 보관 SKU → HAIPICK 피킹 (스마트글라스 불필요)',
    '팔레트랙 보관 SKU, 라인수 ≤3 & 회전율 B/C등급 → 피킹카트 + 스마트글라스',
    '팔레트랙 보관 SKU, 라인수 ≥4 또는 회전율 A등급 → AMR 피킹 + 스마트글라스',
    '오더 라인수 2개 이상(다품목) → 피킹 후 Libiao 3D Sorter로 합포장 분류',
  ],
};

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(n, len = 5) {
  return String(n).padStart(len, '0');
}

// Weighted line-count for an order: mostly single/double line, occasionally more.
function randomLineCount() {
  const r = Math.random();
  if (r < 0.5) return 1;
  if (r < 0.75) return 2;
  if (r < 0.9) return 3;
  return 4;
}

// Produce a plausible carton size for the robot-arm eligibility check. ~70%
// of mixed-carton trucks land within spec (auto-eligible), the rest exceed
// it so the "규격 초과" fallback path is visibly demonstrated too.
function randomBoxDims() {
  const s = INBOUND_BOX_SPEC;
  const withinSpec = Math.random() < 0.7;
  const l = withinSpec ? randomInt(s.minL, s.maxL) : randomInt(s.maxL + 20, s.maxL + 220);
  const w = withinSpec ? randomInt(s.minW, s.maxW) : randomInt(s.maxW + 20, s.maxW + 160);
  const h = withinSpec ? randomInt(s.minH, s.maxH) : randomInt(s.maxH + 20, s.maxH + 150);
  const weight = withinSpec ? randomInt(4, s.maxWeightKg) : randomInt(s.maxWeightKg + 3, s.maxWeightKg + 20);
  const eligible = withinSpec && l <= s.maxL && w <= s.maxW && h <= s.maxH && weight <= s.maxWeightKg;
  return { l, w, h, weight, eligible };
}
