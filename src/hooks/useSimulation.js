import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TOTAL_ORDERS,
  BATCH_SIZE,
  TOTAL_BATCHES,
  INBOUND_COL,
  INBOUND_DOCKS,
  STORAGE_COL_RANGE,
  STORAGE_BANDS,
  SORT_COL,
  SORT_ROW,
  PICKING_COL_RANGE,
  PICKING_LANES,
  OUTBOUND_COL,
  OUTBOUND_DOCKS,
  assignInboundLane,
  pickDock,
  rowInBand,
  randInt,
} from '../data/floorplan.js';
import { INBOUND_DURATIONS, BATCH_DURATIONS, URGENT_DURATIONS } from '../data/timings.js';

const TICK_MS = 100;
const SPAWN_INTERVAL_MS = 420; // sim-time between inbound spawn events at 1x
const REP_TOKENS_PER_BATCH = 24; // representative tokens standing in for 100 real orders
const BOTTLENECK_DURATION_MS = 6500;
const FAILURE_DURATION_MS = 7500;

const BAND_KEYS = { pcs: 'climber', plt: 'shuttle', manual: 'rack' };
const laneToBand = (lane) => BAND_KEYS[lane];

let idSeq = 1;
const nextId = () => idSeq++;

function freshWorld() {
  return {
    inboundItems: [],
    batches: [],
    urgentTokens: [],
    storageCounts: { climber: 0, shuttle: 0, rack: 0 },
    totalAbsorbed: 0,
    totalSpawned: 0,
    batchesFormed: 0,
    completedCount: 0,
    urgentCompleted: 0,
    optimizationEvents: 0,
    leadTimeReduction: 0,
    history: [{ t: 0, absorbed: 0, completed: 0 }],
    simClock: 0,
    spawnTimer: 0,
    metricSample: 0,
    bottleneck: null,
    failure: null,
  };
}

// All mutation below operates synchronously on a single mutable `world`
// object (kept in a ref) - never on React state directly - so the tick
// loop's own logic never depends on when React chooses to run a setState
// updater. React state is a once-per-tick snapshot pushed for rendering.
export default function useSimulation() {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [snapshot, setSnapshot] = useState(() => freshWorld());
  const [events, setEvents] = useState([]);
  const [triggerCooldown, setTriggerCooldown] = useState({});
  const [pulse, setPulse] = useState(null);

  const worldRef = useRef(freshWorld());
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  runningRef.current = running;
  speedRef.current = speed;

  const pushEvent = useCallback((text, tone = 'info') => {
    const id = nextId();
    setEvents((ev) => [...ev, { id, text, tone }]);
    setTimeout(() => setEvents((ev) => ev.filter((e) => e.id !== id)), 4800);
  }, []);

  const flashPulse = useCallback((col, row) => {
    const key = nextId();
    setPulse({ col, row, key });
    setTimeout(() => setPulse((p) => (p && p.key === key ? null : p)), 500);
  }, []);

  const commit = useCallback(() => {
    const w = worldRef.current;
    setSnapshot({
      inboundItems: w.inboundItems,
      batches: w.batches,
      urgentTokens: w.urgentTokens,
      storageCounts: w.storageCounts,
      totalAbsorbed: w.totalAbsorbed,
      totalSpawned: w.totalSpawned,
      batchesFormed: w.batchesFormed,
      completedCount: w.completedCount,
      urgentCompleted: w.urgentCompleted,
      optimizationEvents: w.optimizationEvents,
      leadTimeReduction: w.leadTimeReduction,
      history: w.history,
      bottleneck: w.bottleneck,
      failure: w.failure,
    });
  }, []);

  // ---------------- main tick ----------------
  useEffect(() => {
    const iv = setInterval(() => {
      if (!runningRef.current) return;
      const w = worldRef.current;
      const dt = TICK_MS * speedRef.current;
      w.simClock += dt;
      w.spawnTimer += dt;
      w.metricSample += dt;

      // -- spawn inbound items --
      if (w.totalSpawned < TOTAL_ORDERS && w.spawnTimer >= SPAWN_INTERVAL_MS) {
        w.spawnTimer = 0;
        const n = Math.min(TOTAL_ORDERS - w.totalSpawned, Math.random() < 0.3 ? 2 : 1);
        for (let i = 0; i < n; i++) {
          const lane = assignInboundLane();
          const dock = pickDock(INBOUND_DOCKS);
          const bandKey = laneToBand(lane);
          const band = STORAGE_BANDS[bandKey];
          const slot = {
            col: STORAGE_COL_RANGE[0] + Math.random() * (STORAGE_COL_RANGE[1] - STORAGE_COL_RANGE[0]),
            row: rowInBand(band),
          };
          w.inboundItems.push({
            id: nextId(),
            lane,
            bandKey,
            dock,
            phase: 'decide1',
            t: 0,
            from: { col: INBOUND_COL, row: dock.row },
            to: { col: INBOUND_COL, row: dock.row },
            slot,
          });
        }
        w.totalSpawned += n;
      }

      // -- advance inbound items --
      const nextInbound = [];
      for (const o of w.inboundItems) {
        const t = o.t + dt;
        if (t < INBOUND_DURATIONS[o.phase]) {
          nextInbound.push({ ...o, t });
          continue;
        }
        if (o.phase === 'decide1') {
          const edge = { col: STORAGE_COL_RANGE[0] - 1, row: o.slot.row };
          nextInbound.push({ ...o, phase: 'toEdge', t: 0, from: { col: INBOUND_COL, row: o.dock.row }, to: edge });
        } else if (o.phase === 'toEdge') {
          nextInbound.push({ ...o, phase: 'decide2', t: 0 });
        } else if (o.phase === 'decide2') {
          nextInbound.push({ ...o, phase: 'toSlot', t: 0, from: o.to, to: o.slot });
        } else if (o.phase === 'toSlot') {
          w.storageCounts = { ...w.storageCounts, [o.bandKey]: (w.storageCounts[o.bandKey] || 0) + 1 };
          w.totalAbsorbed += 1;
        } else {
          nextInbound.push(o);
        }
      }
      w.inboundItems = nextInbound;

      // -- form a new outbound batch once enough has accumulated --
      if (w.batchesFormed < TOTAL_BATCHES && w.totalAbsorbed >= (w.batchesFormed + 1) * BATCH_SIZE) {
        const pcsN = Math.round(REP_TOKENS_PER_BATCH * 0.35);
        const pltN = Math.round(REP_TOKENS_PER_BATCH * 0.35);
        const manualN = REP_TOKENS_PER_BATCH - pcsN - pltN;
        const laneList = [...Array(pcsN).fill('pcs'), ...Array(pltN).fill('plt'), ...Array(manualN).fill('manual')];
        const batchId = w.batchesFormed + 1;
        const tokens = laneList.map((lane) => {
          const band = STORAGE_BANDS[laneToBand(lane)];
          const startRow = rowInBand(band);
          return {
            id: nextId(),
            lane,
            phase: 'toSort',
            t: 0,
            from: { col: STORAGE_COL_RANGE[1] + 1, row: startRow },
            to: { col: SORT_COL, row: SORT_ROW },
            pickingLane: lane === 'pcs' ? 'climber' : 'amr',
            rerouted: false,
          };
        });
        w.batches = [...w.batches, { id: batchId, tokens, doneCount: 0 }];
        w.storageCounts = {
          climber: Math.max(0, w.storageCounts.climber - pcsN * 4),
          shuttle: Math.max(0, w.storageCounts.shuttle - pltN * 4),
          rack: Math.max(0, w.storageCounts.rack - manualN * 4),
        };
        w.batchesFormed = batchId;
        pushEvent(`출고그룹 #${batchId} 편성 — 오더 100건 · 3D 소터 분류 시작`, 'info');
        flashPulse(SORT_COL, SORT_ROW);
      }

      // -- advance batch tokens --
      const nextBatches = [];
      for (const batch of w.batches) {
        let doneDelta = 0;
        const nextTokens = [];
        for (const tk of batch.tokens) {
          const t = tk.t + dt;
          if (t < BATCH_DURATIONS[tk.phase]) {
            nextTokens.push({ ...tk, t });
            continue;
          }
          if (tk.phase === 'toSort') {
            nextTokens.push({ ...tk, phase: 'atSort', t: 0 });
          } else if (tk.phase === 'atSort') {
            const laneInfo = PICKING_LANES[tk.pickingLane];
            const row = laneInfo.rowRange[0] + Math.random() * (laneInfo.rowRange[1] - laneInfo.rowRange[0]);
            nextTokens.push({ ...tk, phase: 'toPicking', t: 0, from: { col: SORT_COL, row: SORT_ROW }, to: { col: PICKING_COL_RANGE[0] + 1, row } });
          } else if (tk.phase === 'toPicking') {
            nextTokens.push({ ...tk, phase: 'atPicking', t: 0 });
          } else if (tk.phase === 'atPicking') {
            const failedDockId = w.failure?.dockId;
            let dock = pickDock(OUTBOUND_DOCKS);
            if (failedDockId && dock.id === failedDockId) dock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId) || dock;
            nextTokens.push({ ...tk, phase: 'toOutbound', t: 0, from: tk.to, to: { col: OUTBOUND_COL, row: dock.row }, dock });
          } else if (tk.phase === 'toOutbound') {
            const failedDockId = w.failure?.dockId;
            if (failedDockId && tk.dock?.id === failedDockId) {
              const altDock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId);
              nextTokens.push({ ...tk, phase: 'toOutbound', t: 0, from: tk.to, to: { col: OUTBOUND_COL, row: altDock.row }, dock: altDock, rerouted: true });
            } else {
              nextTokens.push({ ...tk, phase: 'atOutbound', t: 0 });
            }
          } else if (tk.phase === 'atOutbound') {
            doneDelta += 1;
          } else {
            nextTokens.push(tk);
          }
        }
        if (doneDelta > 0) {
          const doneCount = batch.doneCount + doneDelta;
          if (doneCount >= REP_TOKENS_PER_BATCH) {
            w.completedCount += BATCH_SIZE;
            pushEvent(`출고그룹 #${batch.id} 출고 완료 — 100건 발송`, 'ok');
            continue; // drop finished batch
          }
          nextBatches.push({ ...batch, tokens: nextTokens, doneCount });
        } else {
          nextBatches.push({ ...batch, tokens: nextTokens });
        }
      }
      w.batches = nextBatches;

      // -- advance urgent tokens --
      const nextUrgent = [];
      for (const tk of w.urgentTokens) {
        const t = tk.t + dt;
        if (t < URGENT_DURATIONS[tk.phase]) {
          nextUrgent.push({ ...tk, t });
          continue;
        }
        if (tk.phase === 'toPicking') nextUrgent.push({ ...tk, phase: 'atPicking', t: 0 });
        else if (tk.phase === 'atPicking') {
          const dock = OUTBOUND_DOCKS[0];
          nextUrgent.push({ ...tk, phase: 'toOutbound', t: 0, from: tk.to, to: { col: OUTBOUND_COL, row: dock.row } });
        } else if (tk.phase === 'toOutbound') nextUrgent.push({ ...tk, phase: 'atOutbound', t: 0 });
        else if (tk.phase === 'atOutbound') w.urgentCompleted += 1;
        else nextUrgent.push(tk);
      }
      w.urgentTokens = nextUrgent;

      // -- trigger expiry --
      if (w.bottleneck && w.simClock >= w.bottleneck.until) w.bottleneck = null;
      if (w.failure && w.simClock >= w.failure.until) {
        pushEvent(`${w.failure.dockId} 복구 완료 — 정상 라인으로 전환`, 'ok');
        w.failure = null;
      }

      // -- sample history once per sim-second --
      if (w.metricSample >= 1000) {
        w.metricSample = 0;
        w.history = [...w.history, { t: w.history.length, absorbed: w.totalAbsorbed, completed: w.completedCount }].slice(-40);
      }

      commit();
    }, TICK_MS);
    return () => clearInterval(iv);
  }, [pushEvent, flashPulse, commit]);

  // ---------------- triggers ----------------
  const fireCooldown = useCallback((key, ms) => {
    setTriggerCooldown((c) => ({ ...c, [key]: true }));
    setTimeout(() => setTriggerCooldown((c) => ({ ...c, [key]: false })), ms);
  }, []);

  const triggerBottleneck = useCallback(() => {
    if (triggerCooldown.bottleneck) return;
    fireCooldown('bottleneck', BOTTLENECK_DURATION_MS + 1500);
    const w = worldRef.current;
    w.bottleneck = { until: w.simClock + BOTTLENECK_DURATION_MS };
    flashPulse(SORT_COL, SORT_ROW);
    pushEvent('⚠ BOTTLENECK DETECTED — Libiao 3D 소터 허용량 초과', 'danger');

    setTimeout(() => {
      let rerouted = 0;
      w.batches = w.batches.map((batch) => ({
        ...batch,
        tokens: batch.tokens.map((tk) => {
          if ((tk.phase === 'atSort' || tk.phase === 'toPicking') && tk.pickingLane !== 'amr') {
            rerouted += 1;
            return { ...tk, pickingLane: 'amr', rerouted: true };
          }
          return tk;
        }),
      }));
      pushEvent(`WCS OPTIMIZED — 대기 오더 ${rerouted}건 AMR&DPC 라인으로 우회 완료`, 'ok');
      w.optimizationEvents += 1;
      w.leadTimeReduction = Math.min(42, w.leadTimeReduction + randInt(3, 6));
      commit();
    }, 1300);
  }, [pushEvent, fireCooldown, flashPulse, triggerCooldown, commit]);

  const triggerUrgent = useCallback(() => {
    if (triggerCooldown.urgent) return;
    fireCooldown('urgent', 3200);
    const w = worldRef.current;
    const dock = pickDock(INBOUND_DOCKS);
    const climberRow = PICKING_LANES.climber.rowRange[0] + 1;
    w.urgentTokens = [
      ...w.urgentTokens,
      {
        id: nextId(),
        urgent: true,
        phase: 'toPicking',
        t: 0,
        from: { col: INBOUND_COL, row: dock.row },
        to: { col: PICKING_COL_RANGE[0] + 1, row: climberRow },
      },
    ];
    w.optimizationEvents += 1;
    w.leadTimeReduction = Math.min(42, w.leadTimeReduction + 2);
    pushEvent('🔶 긴급 오더 투입 — 보관 단계 건너뛰고 하이클라이머 하이패스', 'urgent');
    commit();
  }, [pushEvent, fireCooldown, triggerCooldown, commit]);

  const triggerFailure = useCallback(() => {
    if (triggerCooldown.failure) return;
    fireCooldown('failure', FAILURE_DURATION_MS + 1500);
    const w = worldRef.current;
    const dock = OUTBOUND_DOCKS[1];
    w.failure = { dockId: dock.id, until: w.simClock + FAILURE_DURATION_MS };
    pushEvent(`✖ ${dock.id} (${dock.method}) ERROR — 설비 정지`, 'danger');

    setTimeout(() => {
      let rerouted = 0;
      w.batches = w.batches.map((batch) => ({
        ...batch,
        tokens: batch.tokens.map((tk) => {
          if (tk.dock?.id === dock.id && (tk.phase === 'toOutbound' || tk.phase === 'atOutbound')) {
            rerouted += 1;
            const altDock = OUTBOUND_DOCKS.find((d) => d.id !== dock.id);
            return { ...tk, dock: altDock, phase: 'toOutbound', t: 0, from: tk.to, to: { col: OUTBOUND_COL, row: altDock.row }, rerouted: true };
          }
          return tk;
        }),
      }));
      pushEvent(`WCS 경로 재탐색 — 출고 대기 물량 ${rerouted}건 재할당`, 'ok');
      w.optimizationEvents += 1;
      w.leadTimeReduction = Math.min(42, w.leadTimeReduction + randInt(2, 4));
      commit();
    }, 1100);
  }, [pushEvent, fireCooldown, triggerCooldown, commit]);

  const reset = useCallback(() => {
    worldRef.current = freshWorld();
    setEvents([]);
    setPulse(null);
    setRunning(true);
    commit();
  }, [commit]);

  return {
    running,
    setRunning,
    speed,
    setSpeed,
    inboundItems: snapshot.inboundItems,
    batches: snapshot.batches,
    urgentTokens: snapshot.urgentTokens,
    storageCounts: snapshot.storageCounts,
    totalAbsorbed: snapshot.totalAbsorbed,
    totalSpawned: snapshot.totalSpawned,
    batchesFormed: snapshot.batchesFormed,
    completedCount: snapshot.completedCount,
    urgentCompleted: snapshot.urgentCompleted,
    events,
    metrics: {
      optimizationEvents: snapshot.optimizationEvents,
      leadTimeReduction: snapshot.leadTimeReduction,
      history: snapshot.history,
    },
    bottleneck: snapshot.bottleneck,
    failure: snapshot.failure,
    pulse,
    triggerCooldown,
    triggerBottleneck,
    triggerUrgent,
    triggerFailure,
    reset,
  };
}

export { TOTAL_ORDERS, BATCH_SIZE, TOTAL_BATCHES };
