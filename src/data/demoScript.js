// The executive walkthrough. Everything WCS says during the scripted opening
// lives here, so the sequencing code stays about timing and the copy stays
// editable without touching the engine.

export const DEMO_TOTAL_ORDERS = 2000;

// Allocation the Phase 2 analysis announces, and that the floor then acts out.
export const DEMO_ALLOCATION = {
  pallet: 738,
  boxPcs: 1262,
  dps: 700,
  cart: 562,
  avgSku: 3.7,
};

export function todayLabel(d = new Date()) {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// Phase 1 - the inbound order lands and WCS reads what arrived.
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

// Phase 1 - the three ways this load could be taken in, and the pick.
export const INBOUND_CANDIDATES = [
  { key: 'manual', label: '일반 지게차', note: '가용, 처리 속도 낮음' },
  { key: 'agv', label: '무인지게차', note: '가용, 팔레트 전용' },
  { key: 'robotArm', label: '로봇암', note: '가용, 혼적 박스 처리 가능', chosen: true },
];

// Phase 2 - the previous day's orders close and the whole book is planned.
export function cutoffTerminalLines(a = DEMO_ALLOCATION) {
  return [
    { text: '입고수량 체크', value: `${DEMO_TOTAL_ORDERS.toLocaleString()}개`, ok: true },
    { text: '평균 SKU 분석', value: `${a.avgSku}`, ok: true },
    { text: '유사 유형 오더 그룹핑 진행', value: '완료', ok: true },
    { text: '작업 할당 진행', value: '', ok: true },
    { text: '└ 팔레트 보관자동화 출고 지시', value: `${a.pallet.toLocaleString()}개`, indent: true },
    { text: '└ 박스/pcs 출고 지시', value: `${a.boxPcs.toLocaleString()}개`, indent: true },
    { text: '   · DPS(컨베이어)', value: `${a.dps.toLocaleString()}개`, indent: true, dim: true },
    { text: '   · DPC(카트)', value: `${a.cart.toLocaleString()}개`, indent: true, dim: true },
    { text: '검수 자동화용 스마트글라스 착용 지시', value: '', ok: true },
    { text: '인원 배정 및 오더 지시 완료', value: '모니터링 모드 전환', ok: true },
  ];
}
