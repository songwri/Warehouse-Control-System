import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TOTAL_ORDERS,
  BATCH_SIZE,
  TOTAL_BATCHES,
  OFFMAP_COL,
  INBOUND_COL,
  INBOUND_DOCKS,
  STORAGE_COL_RANGE,
  STORAGE_BANDS,
  PICKING_COL_RANGE,
  PICKING_LANES,
  SORT_COL,
  SORT_HUBS,
  PACKING_COL,
  PACKING_STATIONS,
  OUTBOUND_COL,
  OUTBOUND_DOCKS,
  pickInboundDock,
  pickCargoType,
  assignStorageBand,
  pickDock,
  rowInBand,
  rowInLane,
  decideGroupType,
  pickPickingLane,
  pickSortHub,
  pickPackMethod,
  randInt,
} from '../data/floorplan.js';
import { VEHICLE_DURATIONS, CARGO_DURATIONS, GROUP_DURATIONS, PALLET_SHIP_DURATIONS, URGENT_DURATIONS } from '../data/timings.js';

const TICK_MS = 100;
const VEHICLE_SPAWN_INTERVAL_MS = 1300; // sim-time between inbound truck spawn attempts at 1x
const WMS_ORDER_INTERVAL_MS = 260; // sim-time between orders landing in the WMS queue at 1x
const GROUP_TOKENS_PER_GROUP = 16; // representative tokens standing in for a real order-group
const PALLET_SHIP_THRESHOLD = 32; // shuttle units accumulated before a pallet shipment forms
const PALLET_SHIP_TOKENS = 6;
const BOTTLENECK_DURATION_MS = 6500;
const FAILURE_DURATION_MS = 7500;

// Picking lanes climber/amr/dpc/dps all draw from a storage band; climber
// serves its own PCS stock, the other three pull general-rack stock.
const LANE_SOURCE_BAND = { climber: 'climber', amr: 'rack', dpc: 'rack', dps: 'rack' };

let idSeq = 1;
const nextId = () => idSeq++;

function wmsThreshold() {
  return randInt(28, 45);
}

function freshWorld() {
  return {
    vehicles: [],
    cargoUnits: [],
    inboundPile: { climber: 0, shuttle: 0, rack: 0 },
    storageCounts: { climber: 0, shuttle: 0, rack: 0 },
    groups: [],
    palletShipments: [],
    urgentTokens: [],
    wmsPendingCount: 0,
    wmsOrdersSpawned: 0,
    wmsGroupsFormed: 0,
    wmsNextThreshold: wmsThreshold(),
    totalAbsorbed: 0,
    completedCount: 0,
    urgentCompleted: 0,
    palletCompleted: 0,
    optimizationEvents: 0,
    leadTimeReduction: 0,
    history: [{ t: 0, absorbed: 0, completed: 0 }],
    simClock: 0,
    vehicleSpawnTimer: VEHICLE_SPAWN_INTERVAL_MS, // spawn one immediately
    wmsTimer: 0,
    metricSample: 0,
    bottleneck: null,
    failure: null,
    story: null,
    storyInboundShown: false,
    storyGroupShown: false,
  };
}

function pickingLanePos(lane) {
  return { col: PICKING_COL_RANGE[0] + 1.4, row: rowInLane(PICKING_LANES[lane]) };
}
function sortHubPos(hub) {
  return { col: SORT_COL, row: SORT_HUBS[hub].row };
}
function packingPos(method) {
  return { col: PACKING_COL, row: PACKING_STATIONS[method].row };
}
function outboundPos(dock) {
  return { col: OUTBOUND_COL, row: dock.row };
}
function storageSourcePos(bandKey) {
  return { col: STORAGE_COL_RANGE[1] + 1, row: rowInBand(STORAGE_BANDS[bandKey]) };
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
    setTimeout(() => setEvents((ev) => ev.filter((e) => e.id !== id)), 7000);
  }, []);

  const flashPulse = useCallback((col, row, from) => {
    const key = nextId();
    setPulse({ col, row, key, from });
    setTimeout(() => setPulse((p) => (p && p.key === key ? null : p)), 900);
  }, []);

  const commit = useCallback(() => {
    const w = worldRef.current;
    setSnapshot({
      vehicles: w.vehicles,
      cargoUnits: w.cargoUnits,
      inboundPile: w.inboundPile,
      storageCounts: w.storageCounts,
      groups: w.groups,
      palletShipments: w.palletShipments,
      urgentTokens: w.urgentTokens,
      wmsPendingCount: w.wmsPendingCount,
      wmsOrdersSpawned: w.wmsOrdersSpawned,
      wmsGroupsFormed: w.wmsGroupsFormed,
      wmsNextThreshold: w.wmsNextThreshold,
      totalAbsorbed: w.totalAbsorbed,
      completedCount: w.completedCount,
      urgentCompleted: w.urgentCompleted,
      palletCompleted: w.palletCompleted,
      optimizationEvents: w.optimizationEvents,
      leadTimeReduction: w.leadTimeReduction,
      history: w.history,
      bottleneck: w.bottleneck,
      failure: w.failure,
      story: w.story,
    });
  }, []);

  // ---------------- main tick ----------------
  useEffect(() => {
    const iv = setInterval(() => {
      if (!runningRef.current) return;
      const w = worldRef.current;
      const dt = TICK_MS * speedRef.current;
      w.simClock += dt;
      w.vehicleSpawnTimer += dt;
      w.wmsTimer += dt;
      w.metricSample += dt;

      // ============ INBOUND: WCS decision #1 - vehicle classification ============
      if (w.vehicleSpawnTimer >= VEHICLE_SPAWN_INTERVAL_MS) {
        w.vehicleSpawnTimer = 0;
        const busyDockIds = new Set(w.vehicles.map((v) => v.dock.id));
        const freeDocks = INBOUND_DOCKS.filter((d) => !busyDockIds.has(d.id));
        if (freeDocks.length) {
          const dock = freeDocks[randInt(0, freeDocks.length - 1)];
          w.vehicles.push({
            id: nextId(),
            dock,
            cargoType: null,
            bandKey: null,
            phase: 'arriving',
            t: 0,
            from: { col: OFFMAP_COL, row: dock.row },
            to: { col: INBOUND_COL, row: dock.row },
          });
        }
      }

      // -- advance vehicles through their dock lifecycle --
      const nextVehicles = [];
      for (const v of w.vehicles) {
        const t = v.t + dt;
        if (t < VEHICLE_DURATIONS[v.phase]) {
          nextVehicles.push({ ...v, t });
          continue;
        }
        if (v.phase === 'arriving') {
          const dockPos = { col: INBOUND_COL, row: v.dock.row };
          nextVehicles.push({ ...v, phase: 'arrived', t: 0, from: dockPos, to: dockPos });
        } else if (v.phase === 'arrived') {
          const cargoType = pickCargoType(v.dock);
          const bandKey = assignStorageBand(cargoType);
          const bandPos = storageSourcePos(bandKey);
          const cargoLabel = cargoType === 'pallet' ? '팔레트' : '박스';
          pushEvent(
            `🚚 ${v.dock.method} 도크 입고 — ${cargoLabel} 판정 · ${STORAGE_BANDS[bandKey].label} 배정`,
            'info'
          );
          flashPulse(bandPos.col, bandPos.row);
          if (!w.storyInboundShown) {
            w.storyInboundShown = true;
            w.story = {
              id: nextId(),
              title: 'WCS 입고 의사결정',
              steps: [
                { icon: '🚚', text: `차량 입고 확인 — ${v.dock.method} 도크` },
                { icon: '📦', text: `입고형태 분석 — ${cargoLabel} 입고 판정` },
                { icon: '🎯', text: `입고 존 결정 — ${STORAGE_BANDS[bandKey].label} 배정` },
                { icon: '🤖', text: `${v.dock.method} 입고 지시 하달` },
                { icon: '🏗', text: `${STORAGE_BANDS[bandKey].label} 보관 지시 하달` },
              ],
            };
          }
          nextVehicles.push({ ...v, phase: 'analyzing', t: 0, cargoType, bandKey });
        } else if (v.phase === 'analyzing') {
          nextVehicles.push({ ...v, phase: 'unloading', t: 0 });
        } else if (v.phase === 'unloading') {
          // spawn cargo units - a pallet is one large unit, a box vehicle
          // unloads several small units, staggered so they visibly trickle out.
          const isPallet = v.cargoType === 'pallet';
          const unitCount = isPallet ? 1 : randInt(3, 6);
          for (let i = 0; i < unitCount; i++) {
            const dockPos = { col: INBOUND_COL, row: v.dock.row };
            const edge = { col: STORAGE_COL_RANGE[0] - 1, row: rowInBand(STORAGE_BANDS[v.bandKey]) };
            w.cargoUnits.push({
              id: nextId(),
              kind: isPallet ? 'pallet' : 'box',
              bandKey: v.bandKey,
              phase: 'toEdge',
              t: -i * 220,
              from: dockPos,
              to: edge,
            });
          }
          w.inboundPile = { ...w.inboundPile, [v.bandKey]: (w.inboundPile[v.bandKey] || 0) + unitCount };
          nextVehicles.push({ ...v, phase: 'leaving', t: 0, from: { col: INBOUND_COL, row: v.dock.row }, to: { col: OFFMAP_COL, row: v.dock.row } });
        } else {
          // 'leaving' finished - drop the vehicle, freeing the dock.
        }
      }
      w.vehicles = nextVehicles;

      // -- advance cargo units (dock -> storage edge -> storage slot) --
      const nextCargo = [];
      for (const u of w.cargoUnits) {
        const t = u.t + dt;
        if (t < CARGO_DURATIONS[u.phase]) {
          nextCargo.push({ ...u, t });
          continue;
        }
        if (u.phase === 'toEdge') {
          w.inboundPile = { ...w.inboundPile, [u.bandKey]: Math.max(0, (w.inboundPile[u.bandKey] || 0) - 1) };
          const slot = { col: STORAGE_COL_RANGE[0] + Math.random() * (STORAGE_COL_RANGE[1] - STORAGE_COL_RANGE[0]), row: rowInBand(STORAGE_BANDS[u.bandKey]) };
          nextCargo.push({ ...u, phase: 'toSlot', t: 0, from: u.to, to: slot });
        } else if (u.phase === 'toSlot') {
          w.storageCounts = { ...w.storageCounts, [u.bandKey]: (w.storageCounts[u.bandKey] || 0) + 1 };
          w.totalAbsorbed += 1;
          // dropped - absorbed into storage
        } else {
          nextCargo.push(u);
        }
      }
      w.cargoUnits = nextCargo;

      // ============ WMS: WCS decision #2 - order grouping ============
      if (w.wmsTimer >= WMS_ORDER_INTERVAL_MS) {
        w.wmsTimer = 0;
        if (w.wmsOrdersSpawned < TOTAL_ORDERS) {
          w.wmsOrdersSpawned += 1;
          w.wmsPendingCount += 1;
        }
      }

      if (w.wmsPendingCount >= w.wmsNextThreshold) {
        const groupSize = w.wmsNextThreshold;
        w.wmsPendingCount -= groupSize;
        w.wmsNextThreshold = wmsThreshold();
        const groupType = decideGroupType();
        const groupId = w.wmsGroupsFormed + 1;
        w.wmsGroupsFormed = groupId;
        const tokens = Array.from({ length: GROUP_TOKENS_PER_GROUP }).map(() => {
          const lane = pickPickingLane(groupType);
          const sourceBand = LANE_SOURCE_BAND[lane];
          return {
            id: nextId(),
            lane,
            groupType,
            phase: 'toPicking',
            t: 0,
            from: storageSourcePos(sourceBand),
            to: pickingLanePos(lane),
            sourceBand,
            rerouted: false,
          };
        });
        w.groups = [...w.groups, { id: groupId, type: groupType, size: groupSize, tokens, doneCount: 0 }];
        const pickTypeLabel = groupType === 'bulk' ? '총량피킹' : '오더피킹';
        pushEvent(`WCS 그룹핑 — OG-${groupId} (${pickTypeLabel}, ${groupSize}건)`, 'info');
        flashPulse(PICKING_COL_RANGE[0] + 1, 5.5);

        if (!w.storyGroupShown) {
          w.storyGroupShown = true;
          const leadLane = tokens[0].lane;
          const laneInfo = PICKING_LANES[leadLane];
          const wearsGlasses = leadLane === 'amr' || leadLane === 'dpc';
          const steps = [
            { icon: '📋', text: `오더 마감 — ${groupSize}건 접수 완료` },
            { icon: '🔍', text: `주문 형태 분석 — ${pickTypeLabel} 실시` },
            { icon: '🦾', text: `${laneInfo.label} 피킹 지시` },
          ];
          if (wearsGlasses) steps.push({ icon: '🥽', text: '스마트글라스 착용 요청 — 피킹 정확도 검증' });
          if (groupType === 'bulk') steps.push({ icon: '🔀', text: '분류(SORT) 경유 지시 — 개별 오더 재구성' });
          w.story = { id: nextId(), title: 'WCS 오더 그룹핑 의사결정', steps };
        }
      }

      // -- advance order-group tokens --
      const nextGroups = [];
      for (const group of w.groups) {
        let doneDelta = 0;
        const nextTokens = [];
        for (const tk of group.tokens) {
          const t = tk.t + dt;
          if (t < GROUP_DURATIONS[tk.phase]) {
            nextTokens.push({ ...tk, t });
            continue;
          }
          if (tk.phase === 'toPicking') {
            nextTokens.push({ ...tk, phase: 'atPicking', t: 0 });
          } else if (tk.phase === 'atPicking') {
            w.storageCounts = { ...w.storageCounts, [tk.sourceBand]: Math.max(0, (w.storageCounts[tk.sourceBand] || 0) - 1) };
            const fromPos = pickingLanePos(tk.lane);
            if (tk.groupType === 'bulk') {
              const sortHub = pickSortHub();
              nextTokens.push({ ...tk, phase: 'toSort', t: 0, from: fromPos, to: sortHubPos(sortHub), sortHub });
            } else {
              const packMethod = pickPackMethod();
              nextTokens.push({ ...tk, phase: 'toPacking', t: 0, from: fromPos, to: packingPos(packMethod), packMethod });
            }
          } else if (tk.phase === 'toSort') {
            nextTokens.push({ ...tk, phase: 'atSort', t: 0 });
          } else if (tk.phase === 'atSort') {
            const packMethod = pickPackMethod();
            nextTokens.push({ ...tk, phase: 'toPacking', t: 0, from: sortHubPos(tk.sortHub), to: packingPos(packMethod), packMethod });
          } else if (tk.phase === 'toPacking') {
            nextTokens.push({ ...tk, phase: 'atPacking', t: 0 });
          } else if (tk.phase === 'atPacking') {
            const failedDockId = w.failure?.dockId;
            let dock = pickDock(OUTBOUND_DOCKS);
            if (failedDockId && dock.id === failedDockId) dock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId) || dock;
            nextTokens.push({ ...tk, phase: 'toOutbound', t: 0, from: packingPos(tk.packMethod), to: outboundPos(dock), dock });
          } else if (tk.phase === 'toOutbound') {
            const failedDockId = w.failure?.dockId;
            if (failedDockId && tk.dock?.id === failedDockId) {
              const altDock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId);
              nextTokens.push({ ...tk, phase: 'toOutbound', t: 0, from: tk.to, to: outboundPos(altDock), dock: altDock, rerouted: true });
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
          const doneCount = group.doneCount + doneDelta;
          if (doneCount >= GROUP_TOKENS_PER_GROUP) {
            w.completedCount = Math.min(TOTAL_ORDERS, w.completedCount + group.size);
            pushEvent(`OG-${group.id} 출고 완료 — ${group.size}건 발송`, 'ok');
            continue; // drop finished group
          }
          nextGroups.push({ ...group, tokens: nextTokens, doneCount });
        } else {
          nextGroups.push({ ...group, tokens: nextTokens });
        }
      }
      w.groups = nextGroups;

      // ============ Shuttle -> pallet-unit direct shipment (skips picking & sort) ============
      // Flat modulo-style check (not a cumulative watermark) so a shipment
      // fires every time PALLET_SHIP_THRESHOLD units are sitting on the
      // shuttle, regardless of how many shipments already went out.
      if (w.storageCounts.shuttle >= PALLET_SHIP_THRESHOLD) {
        w.storageCounts = { ...w.storageCounts, shuttle: w.storageCounts.shuttle - PALLET_SHIP_THRESHOLD };
        const shipId = (w.palletShipments.length ? Math.max(...w.palletShipments.map((s) => s.id)) : 0) + 1;
        const tokens = Array.from({ length: PALLET_SHIP_TOKENS }).map(() => {
          const packMethod = pickPackMethod();
          return {
            id: nextId(),
            phase: 'toPacking',
            t: 0,
            from: storageSourcePos('shuttle'),
            to: packingPos(packMethod),
            packMethod,
            rerouted: false,
          };
        });
        w.palletShipments = [...w.palletShipments, { id: shipId, size: PALLET_SHIP_THRESHOLD, tokens, doneCount: 0 }];
        pushEvent(`4-Way 셔틀 — 팔레트 출고그룹 편성 (${PALLET_SHIP_THRESHOLD}건, 포장 후 즉시 출고)`, 'info');
        flashPulse(PACKING_COL, 6);
      }

      const nextShipments = [];
      for (const ship of w.palletShipments) {
        let doneDelta = 0;
        const nextTokens = [];
        for (const tk of ship.tokens) {
          const t = tk.t + dt;
          if (t < PALLET_SHIP_DURATIONS[tk.phase]) {
            nextTokens.push({ ...tk, t });
            continue;
          }
          if (tk.phase === 'toPacking') {
            nextTokens.push({ ...tk, phase: 'atPacking', t: 0 });
          } else if (tk.phase === 'atPacking') {
            const failedDockId = w.failure?.dockId;
            let dock = pickDock(OUTBOUND_DOCKS);
            if (failedDockId && dock.id === failedDockId) dock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId) || dock;
            nextTokens.push({ ...tk, phase: 'toOutbound', t: 0, from: packingPos(tk.packMethod), to: outboundPos(dock), dock });
          } else if (tk.phase === 'toOutbound') {
            const failedDockId = w.failure?.dockId;
            if (failedDockId && tk.dock?.id === failedDockId) {
              const altDock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId);
              nextTokens.push({ ...tk, phase: 'toOutbound', t: 0, from: tk.to, to: outboundPos(altDock), dock: altDock, rerouted: true });
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
          const doneCount = ship.doneCount + doneDelta;
          if (doneCount >= PALLET_SHIP_TOKENS) {
            w.palletCompleted += ship.size;
            pushEvent(`팔레트 출고그룹 #${ship.id} 완료 — ${ship.size}건 발송`, 'ok');
            continue;
          }
          nextShipments.push({ ...ship, tokens: nextTokens, doneCount });
        } else {
          nextShipments.push({ ...ship, tokens: nextTokens });
        }
      }
      w.palletShipments = nextShipments;

      // -- advance urgent tokens (skip storage entirely, climber high-pass) --
      const nextUrgent = [];
      for (const tk of w.urgentTokens) {
        const t = tk.t + dt;
        if (t < URGENT_DURATIONS[tk.phase]) {
          nextUrgent.push({ ...tk, t });
          continue;
        }
        if (tk.phase === 'toPicking') nextUrgent.push({ ...tk, phase: 'atPicking', t: 0 });
        else if (tk.phase === 'atPicking') {
          const dock = pickDock(OUTBOUND_DOCKS);
          nextUrgent.push({ ...tk, phase: 'toOutbound', t: 0, from: tk.to, to: outboundPos(dock) });
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
    flashPulse(SORT_COL, SORT_HUBS.libiao.row);
    pushEvent('⚠ BOTTLENECK DETECTED — Libiao 3D 소터 허용량 초과', 'danger');

    setTimeout(() => {
      let rerouted = 0;
      w.groups = w.groups.map((group) => ({
        ...group,
        tokens: group.tokens.map((tk) => {
          if ((tk.phase === 'toSort' || tk.phase === 'atSort') && tk.sortHub === 'libiao') {
            rerouted += 1;
            return { ...tk, sortHub: 'das', to: tk.phase === 'toSort' ? sortHubPos('das') : tk.to, rerouted: true };
          }
          return tk;
        }),
      }));
      pushEvent(`WCS OPTIMIZED — 대기 오더 ${rerouted}건 DAS 라인으로 우회 완료`, 'ok');
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
    w.urgentTokens = [
      ...w.urgentTokens,
      {
        id: nextId(),
        urgent: true,
        phase: 'toPicking',
        t: 0,
        from: { col: INBOUND_COL, row: dock.row },
        to: pickingLanePos('climber'),
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
      const reroute = (tk) => {
        if (tk.dock?.id === dock.id && (tk.phase === 'toOutbound' || tk.phase === 'atOutbound')) {
          rerouted += 1;
          const altDock = OUTBOUND_DOCKS.find((d) => d.id !== dock.id);
          return { ...tk, dock: altDock, phase: 'toOutbound', t: 0, from: tk.to, to: outboundPos(altDock), rerouted: true };
        }
        return tk;
      };
      w.groups = w.groups.map((group) => ({ ...group, tokens: group.tokens.map(reroute) }));
      w.palletShipments = w.palletShipments.map((ship) => ({ ...ship, tokens: ship.tokens.map(reroute) }));
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
    vehicles: snapshot.vehicles,
    cargoUnits: snapshot.cargoUnits,
    inboundPile: snapshot.inboundPile,
    storageCounts: snapshot.storageCounts,
    groups: snapshot.groups,
    palletShipments: snapshot.palletShipments,
    urgentTokens: snapshot.urgentTokens,
    wmsPendingCount: snapshot.wmsPendingCount,
    wmsOrdersSpawned: snapshot.wmsOrdersSpawned,
    wmsGroupsFormed: snapshot.wmsGroupsFormed,
    wmsNextThreshold: snapshot.wmsNextThreshold,
    totalAbsorbed: snapshot.totalAbsorbed,
    completedCount: snapshot.completedCount,
    urgentCompleted: snapshot.urgentCompleted,
    palletCompleted: snapshot.palletCompleted,
    events,
    metrics: {
      optimizationEvents: snapshot.optimizationEvents,
      leadTimeReduction: snapshot.leadTimeReduction,
      history: snapshot.history,
    },
    bottleneck: snapshot.bottleneck,
    failure: snapshot.failure,
    story: snapshot.story,
    pulse,
    triggerCooldown,
    triggerBottleneck,
    triggerUrgent,
    triggerFailure,
    reset,
  };
}

export { TOTAL_ORDERS, BATCH_SIZE, TOTAL_BATCHES };
