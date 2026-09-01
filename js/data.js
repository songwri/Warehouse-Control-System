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

// SKU master pool used to fabricate plausible inbound/outbound data
const SKU_POOL = [
  { sku: 'SKU-88213', name: '무선 이어폰', unit: 'PCS', category: '가전' },
  { sku: 'SKU-40291', name: '텀블러 세트', unit: 'PCS', category: '생활' },
  { sku: 'SKU-77120', name: '생수 24입', unit: 'PLT', category: '식품' },
  { sku: 'SKU-15542', name: '즉석밥 박스', unit: 'PLT', category: '식품' },
  { sku: 'SKU-93087', name: '섬유유연제', unit: 'PLT', category: '생활' },
  { sku: 'SKU-22765', name: '블루투스 스피커', unit: 'PCS', category: '가전' },
  { sku: 'SKU-61048', name: '반려동물 사료', unit: 'PLT', category: '펫' },
  { sku: 'SKU-30456', name: '핸드크림', unit: 'PCS', category: '뷰티' },
  { sku: 'SKU-58821', name: '커피캡슐 박스', unit: 'PLT', category: '식품' },
  { sku: 'SKU-70933', name: '스마트워치', unit: 'PCS', category: '가전' },
  { sku: 'SKU-19204', name: '주방세제', unit: 'PLT', category: '생활' },
  { sku: 'SKU-84410', name: '보조배터리', unit: 'PCS', category: '가전' },
];

const CARRIERS = ['CJ대한통운', '한진택배', '롯데글로벌로지스', '로젠택배', '쿠팡물류'];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(n, len = 5) {
  return String(n).padStart(len, '0');
}
