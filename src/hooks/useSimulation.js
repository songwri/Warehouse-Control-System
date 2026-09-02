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
  BYPASS_ROW,
  PACKING_COL,
  PACKING_STATIONS,
  OUTBOUND_COL,
  OUTBOUND_DOCKS,
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
const VEHICLE_SPAWN_INTERVAL_MS = 1900; // sim-time between inbound truck spawn attempts at 1x
const WMS_ORDER_INTERVAL_MS = 340; // sim-time between orders landing in the WMS queue at 1x
const GROUP_TOKENS_PER_GROUP = 7; // representative tokens per order-group - kept low so each is trackable
const AUTO_EVENT_MIN_MS = 110000; // sim-time between self-firing incidents
const AUTO_EVENT_MAX_MS = 165000;
const PALLET_SHIP_THRESHOLD = 32; // shuttle units accumulated before a pallet shipment forms
const PALLET_SHIP_TOKENS = 4;
const BOTTLENECK_DURATION_MS = 6500;
const FAILURE_DURATION_MS = 7500;
const CALLOUT_MS = 2400; // how long a "why" callout stays over its building
const CORE_CAPTION_MS = 2600; // how long the WCS core's current-reasoning caption stays up
const DASH_THROTTLE_MS = 800; // real-time gate on dashboard numbers so they don't jitter
const MODAL_LOCKOUT_MS = 21000; // roughly the decision modal's own runtime

// Picking lanes climber/amr/dpc/dps all draw from a storage band; climber
// serves its own PCS stock, the other three pull general-rack stock.
const LANE_SOURCE_BAND = { climber: 'climber', amr: 'rack', dpc: 'rack', dps: 'rack' };

let idSeq = 1;
const nextId = () => idSeq++;

function wmsThreshold() {
  return randInt(120, 170);
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
    history: [{ t: 0, inRate: 0, outRate: 0 }],
    sampleIn: 0,
    sampleOut: 0,
    simClock: 0,
    vehicleSpawnTimer: VEHICLE_SPAWN_INTERVAL_MS, // spawn one immediately
    wmsTimer: 0,
    metricSample: 0,
    bottleneck: null,
    failure: null,
    story: null,
    storyQueue: [],
    storyInboundShown: false,
    callouts: [],
    coreCaption: null,
    autoEventAt: randInt(AUTO_EVENT_MIN_MS, AUTO_EVENT_MAX_MS),
    // Running ledger of every routing call WCS makes - shown as live counters
    // instead of a text feed that scrolls faster than anyone can read.
    counts: { inbound: 0, storage: 0, order: 0, grouping: 0, picking: 0, sorting: 0, packing: 0, outbound: 0 },
  };
}

// Cinematics are queued, never played on top of each other; the tick loop
// drains one at a time and freezes the board while it runs.
function enqueueStory(w, story, effect = null) {
  w.storyQueue = [...w.storyQueue, { story, effect }];
}

// A short-lived floating "why" label anchored over a specific building -
// makes an individual unit's routing reason legible instead of it just
// flowing past. Callouts already active at the same building stack
// upward (extra elevation) instead of overlapping illegibly.
function addCallout(w, col, row, text, tone = 'info') {
  const sameSpot = w.callouts.filter((c) => c.col === col && Math.round(c.baseRow) === Math.round(row));
  // A burst of identical arrivals (three trucks assigned the same way in a
  // row) used to print the same chip three times; refresh the live one
  // instead so the stack only ever carries distinct reasons.
  const dupe = sameSpot.find((c) => c.text === text);
  if (dupe) {
    w.callouts = w.callouts.map((c) => (c.id === dupe.id ? { ...c, until: w.simClock + CALLOUT_MS } : c));
    return;
  }
  // Capped so a burst of arrivals can't run the stack off the top of the board.
  const elevation = 100 + Math.min(sameSpot.length, 1) * 32;
  w.callouts = [
    ...w.callouts,
    { id: nextId(), col, row, baseRow: row, elevation, text, tone, until: w.simClock + CALLOUT_MS },
  ];
}

// The WCS core's running "what am I deciding right now" readout - updated
// on every vehicle- and group-level decision, not just the one-time story.
function setCoreCaption(w, text) {
  w.coreCaption = { id: nextId(), text, until: w.simClock + CORE_CAPTION_MS };
}

function pickingLanePos(lane) {
  return { col: PICKING_COL_RANGE[0] + 1.4, row: rowInLane(PICKING_LANES[lane]) };
}
function sortHubPos(hub) {
  return { col: SORT_COL, row: SORT_HUBS[hub].row };
}
function bypassPos() {
  return { col: SORT_COL, row: BYPASS_ROW };
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
function storageBuildingPos(bandKey) {
  const band = STORAGE_BANDS[bandKey];
  return { col: STORAGE_COL_RANGE[0] + 1, row: (band.rowRange[0] + band.rowRange[1]) / 2 };
}

// Only the slow-moving figures the dashboard reads - split out so they can be
// published on their own throttled cadence instead of at animation framerate.
function buildDash(w) {
  return {
    storageCounts: w.storageCounts,
    totalAbsorbed: w.totalAbsorbed,
    wmsPendingCount: w.wmsPendingCount,
    wmsNextThreshold: w.wmsNextThreshold,
    wmsGroupsFormed: w.wmsGroupsFormed,
    completedCount: w.completedCount,
    urgentCompleted: w.urgentCompleted,
    palletCompleted: w.palletCompleted,
    optimizationEvents: w.optimizationEvents,
    leadTimeReduction: w.leadTimeReduction,
    history: w.history,
    counts: w.counts,
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

  const [dash, setDash] = useState(() => buildDash(freshWorld()));

  const worldRef = useRef(freshWorld());
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  const dashAtRef = useRef(0);
  const pendingEffectRef = useRef(null);
  const wasRunningRef = useRef(true);
  const makeEventRef = useRef(null);
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
      callouts: w.callouts,
      coreCaption: w.coreCaption,
    });

    // Dashboard figures publish on their own throttled cadence so the tiles
    // and chart settle instead of churning at animation framerate.
    const now = Date.now();
    if (now - dashAtRef.current >= DASH_THROTTLE_MS) {
      dashAtRef.current = now;
      setDash(buildDash(w));
    }
  }, []);

  // ---------------- main tick ----------------
  useEffect(() => {
    const iv = setInterval(() => {
      if (!runningRef.current) return;
      const w = worldRef.current;

      // A queued cinematic takes priority over everything: freeze the board,
      // play it, and let finishStory() apply its effect and resume.
      if (!w.story && w.storyQueue.length) {
        const next = w.storyQueue[0];
        w.storyQueue = w.storyQueue.slice(1);
        wasRunningRef.current = true; // the tick only runs while playing
        pendingEffectRef.current = next.effect;
        w.story = { id: nextId(), modal: true, ...next.story };
        setRunning(false);
        commit();
        return;
      }

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
            `🚚 ${v.dock.method} 도크 입고, ${cargoLabel} 판정 · ${STORAGE_BANDS[bandKey].label} 배정`,
            'info'
          );
          flashPulse(bandPos.col, bandPos.row);
          setCoreCaption(w, `판단: ${v.dock.method} 입고 → ${STORAGE_BANDS[bandKey].label} 배정`);
          w.counts = { ...w.counts, inbound: w.counts.inbound + 1 };
          if (!w.storyInboundShown) {
            w.storyInboundShown = true;
            enqueueStory(w, {
              title: 'WCS 입고 의사결정',
              tone: 'info',
              lines: [
                `${v.dock.method} 도크 차량 도착, 적재 형태 판독 결과 ${cargoLabel} 입고`,
                `회전율·단위·가용 슬롯 대조, 보관존 후보 3개 비교`,
                `${STORAGE_BANDS[bandKey].label} 배정, ${v.dock.method} 하차 지시 하달`,
              ],
            });
          }
          nextVehicles.push({ ...v, phase: 'analyzing', t: 0, cargoType, bandKey });
        } else if (v.phase === 'analyzing') {
          nextVehicles.push({ ...v, phase: 'unloading', t: 0 });
        } else if (v.phase === 'unloading') {
          // spawn cargo units - a pallet is one large unit, a box vehicle
          // unloads several small units, staggered so they visibly trickle out.
          const isPallet = v.cargoType === 'pallet';
          const unitCount = isPallet ? 1 : randInt(2, 4);
          for (let i = 0; i < unitCount; i++) {
            const dockPos = { col: INBOUND_COL, row: v.dock.row };
            const edge = { col: STORAGE_COL_RANGE[0] - 1, row: rowInBand(STORAGE_BANDS[v.bandKey]) };
            w.cargoUnits.push({
              id: nextId(),
              kind: isPallet ? 'pallet' : 'box',
              bandKey: v.bandKey,
              vehicleMethod: v.dock.method,
              phase: 'toEdge',
              t: -i * 300,
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
          w.counts = { ...w.counts, storage: w.counts.storage + 1 };
          w.sampleIn += 1;
          const bPos = storageBuildingPos(u.bandKey);
          addCallout(w, bPos.col, bPos.row, `+1 입고 · ${u.vehicleMethod} 지시`, 'ok');
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
          w.counts = { ...w.counts, order: w.counts.order + 1 };
        }
      }

      if (w.wmsPendingCount >= w.wmsNextThreshold) {
        const groupSize = w.wmsNextThreshold;
        w.wmsPendingCount -= groupSize;
        w.wmsNextThreshold = wmsThreshold();
        const groupType = decideGroupType();
        const groupId = w.wmsGroupsFormed + 1;
        w.wmsGroupsFormed = groupId;
        // Staggered negative `t` (like cargo units) so the group's tokens
        // don't move in lockstep as one indistinguishable clump - each
        // order visibly departs storage and arrives at picking on its own.
        const tokens = Array.from({ length: GROUP_TOKENS_PER_GROUP }).map((_, i) => {
          const lane = pickPickingLane(groupType);
          const sourceBand = LANE_SOURCE_BAND[lane];
          return {
            id: nextId(),
            lane,
            groupType,
            phase: 'toPicking',
            t: -i * 480,
            from: storageSourcePos(sourceBand),
            to: pickingLanePos(lane),
            sourceBand,
            rerouted: false,
          };
        });
        w.groups = [...w.groups, { id: groupId, type: groupType, size: groupSize, tokens, doneCount: 0 }];
        const pickTypeLabel = groupType === 'bulk' ? '총량피킹' : '오더피킹';
        pushEvent(`WCS 그룹핑 · OG-${groupId} (${pickTypeLabel}, ${groupSize}건)`, 'info');
        flashPulse(PICKING_COL_RANGE[0] + 1, 5.5);
        setCoreCaption(w, `판단: OG-${groupId} ${groupSize}건 → ${pickTypeLabel} 편성`);
        w.counts = { ...w.counts, grouping: w.counts.grouping + 1 };

        // Every grouping is a cinematic: WCS explains why this batch was cut
        // the way it was, and which equipment it just committed the work to.
        const tally = tokens.reduce((m, t) => ({ ...m, [t.lane]: (m[t.lane] || 0) + 1 }), {});
        const laneText = Object.entries(tally)
          .map(([k, v]) => `${PICKING_LANES[k].label} ${v}`)
          .join(' · ');
        const wearsGlasses = !!(tally.amr || tally.dpc);
        const reason =
          groupType === 'bulk'
            ? '오더라인 단순, 동일 SKU 중복 다수로 묶음 처리 이득'
            : '오더라인 복합, SKU 분산으로 건별 처리가 유리';
        const routeText =
          groupType === 'bulk'
            ? '분류(3D 소터 / DAS) 경유 후 포장'
            : '분류 미경유, 직행 레인으로 포장 연결';
        enqueueStory(w, {
          title: `WCS 오더 그룹핑 의사결정 · OG-${groupId}`,
          tone: groupType === 'bulk' ? 'info' : 'urgent',
          lines: [
            `대기 오더 ${groupSize}건 마감, OG-${groupId} 편성`,
            `${reason}, ${pickTypeLabel} 판정`,
            `${laneText} 배정${wearsGlasses ? ', 스마트글라스 착용 지시' : ''}. ${routeText}`,
          ],
        });
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
            const srcPos = storageBuildingPos(tk.sourceBand);
            addCallout(w, srcPos.col, srcPos.row, `오더 발생 · ${PICKING_LANES[tk.lane].label} 피킹 (-1)`, 'urgent');
            const fromPos = pickingLanePos(tk.lane);
            w.counts = { ...w.counts, picking: w.counts.picking + 1 };
            if (tk.groupType === 'bulk') {
              // While a sorter bottleneck is live, WCS keeps steering *new*
              // bulk work to DAS too - not just the batch already queued.
              const sortHub = w.bottleneck ? 'das' : pickSortHub();
              w.counts = { ...w.counts, sorting: w.counts.sorting + 1 };
              nextTokens.push({ ...tk, phase: 'toSort', t: 0, from: fromPos, to: sortHubPos(sortHub), sortHub, rerouted: !!w.bottleneck });
            } else {
              // Order-picked work runs the express strip over the sorters so
              // "no sort needed" is a visible route, not an invisible skip.
              nextTokens.push({ ...tk, phase: 'toBypass', t: 0, from: fromPos, to: bypassPos() });
            }
          } else if (tk.phase === 'toBypass') {
            const packMethod = pickPackMethod();
            w.counts = { ...w.counts, packing: w.counts.packing + 1 };
            nextTokens.push({ ...tk, phase: 'toPacking', t: 0, from: bypassPos(), to: packingPos(packMethod), packMethod });
          } else if (tk.phase === 'toSort') {
            nextTokens.push({ ...tk, phase: 'atSort', t: 0 });
          } else if (tk.phase === 'atSort') {
            const packMethod = pickPackMethod();
            w.counts = { ...w.counts, packing: w.counts.packing + 1 };
            nextTokens.push({ ...tk, phase: 'toPacking', t: 0, from: sortHubPos(tk.sortHub), to: packingPos(packMethod), packMethod });
          } else if (tk.phase === 'toPacking') {
            nextTokens.push({ ...tk, phase: 'atPacking', t: 0 });
          } else if (tk.phase === 'atPacking') {
            const failedDockId = w.failure?.dockId;
            let dock = pickDock(OUTBOUND_DOCKS);
            if (failedDockId && dock.id === failedDockId) dock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId) || dock;
            w.counts = { ...w.counts, outbound: w.counts.outbound + 1 };
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
            w.sampleOut += 1;
            doneDelta += 1;
          } else {
            nextTokens.push(tk);
          }
        }
        if (doneDelta > 0) {
          const doneCount = group.doneCount + doneDelta;
          if (doneCount >= GROUP_TOKENS_PER_GROUP) {
            w.completedCount = Math.min(TOTAL_ORDERS, w.completedCount + group.size);
            pushEvent(`OG-${group.id} 출고 완료, ${group.size}건 발송`, 'ok');
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
        const tokens = Array.from({ length: PALLET_SHIP_TOKENS }).map((_, i) => {
          const packMethod = pickPackMethod();
          return {
            id: nextId(),
            phase: 'toPacking',
            t: -i * 480,
            from: storageSourcePos('shuttle'),
            to: packingPos(packMethod),
            packMethod,
            rerouted: false,
          };
        });
        w.palletShipments = [...w.palletShipments, { id: shipId, size: PALLET_SHIP_THRESHOLD, tokens, doneCount: 0 }];
        pushEvent(`4-Way 셔틀 팔레트 출고그룹 편성 (${PALLET_SHIP_THRESHOLD}건, 포장 후 즉시 출고)`, 'info');
        flashPulse(PACKING_COL, 6);
        setCoreCaption(w, `판단: 4-Way 셔틀 팔레트 ${PALLET_SHIP_THRESHOLD}건 → 즉시 출고`);
        const shuttlePos = storageBuildingPos('shuttle');
        addCallout(w, shuttlePos.col, shuttlePos.row, `오더 발생 · 팔레트 직송 출고 (-${PALLET_SHIP_THRESHOLD})`, 'urgent');
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
            w.sampleOut += 1;
            doneDelta += 1;
          } else {
            nextTokens.push(tk);
          }
        }
        if (doneDelta > 0) {
          const doneCount = ship.doneCount + doneDelta;
          if (doneCount >= PALLET_SHIP_TOKENS) {
            w.palletCompleted += ship.size;
            pushEvent(`팔레트 출고그룹 #${ship.id} 완료, ${ship.size}건 발송`, 'ok');
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
        else if (tk.phase === 'atOutbound') {
          w.urgentCompleted += 1;
          w.sampleOut += 1;
        }
        else nextUrgent.push(tk);
      }
      w.urgentTokens = nextUrgent;

      // -- incidents fire on their own, the way they do on a real floor --
      if (w.simClock >= w.autoEventAt && !w.story && !w.storyQueue.length) {
        w.autoEventAt = w.simClock + randInt(AUTO_EVENT_MIN_MS, AUTO_EVENT_MAX_MS);
        const options = ['urgent'];
        if (!w.bottleneck) options.push('bottleneck');
        if (!w.failure) options.push('failure');
        makeEventRef.current?.(options[randInt(0, options.length - 1)], { auto: true });
      }

      // -- trigger / callout / core-caption expiry --
      if (w.callouts.length) w.callouts = w.callouts.filter((c) => c.until > w.simClock);
      if (w.coreCaption && w.simClock >= w.coreCaption.until) w.coreCaption = null;
      if (w.bottleneck && w.simClock >= w.bottleneck.until) w.bottleneck = null;
      if (w.failure && w.simClock >= w.failure.until) {
        pushEvent(`${w.failure.dockId} 복구 완료, 정상 라인으로 전환`, 'ok');
        w.failure = null;
      }

      // -- sample history once per sim-second --
      if (w.metricSample >= 1000) {
        w.metricSample = 0;
        w.history = [...w.history, { t: w.history.length, inRate: w.sampleIn, outRate: w.sampleOut }].slice(-46);
        w.sampleIn = 0;
        w.sampleOut = 0;
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

  // A presenter-fired event freezes the board, dims the screen and plays the
  // decision out full-size; the routing change itself is deferred until the
  // narration finishes, so the audience sees the reasoning before the result.
  const runDecisionModal = useCallback(
    (story, effect) => {
      const w = worldRef.current;
      wasRunningRef.current = runningRef.current;
      setRunning(false);
      pendingEffectRef.current = effect;
      w.story = { id: nextId(), modal: true, ...story };
      commit();
    },
    [commit]
  );

  const finishStory = useCallback(() => {
    const w = worldRef.current;
    const effect = pendingEffectRef.current;
    pendingEffectRef.current = null;
    if (effect) effect(w);
    w.story = null;
    commit();
    if (wasRunningRef.current) setRunning(true);
  }, [commit]);

  // One builder per incident kind. Button presses play immediately (unless a
  // cinematic is already on screen); self-fired incidents always queue.
  const makeEvent = useCallback(
    (kind, { auto = false } = {}) => {
      const w = worldRef.current;
      let story;
      let effect;

      if (kind === 'bottleneck') {
        w.bottleneck = { until: w.simClock + BOTTLENECK_DURATION_MS + MODAL_LOCKOUT_MS };
        flashPulse(SORT_COL, SORT_HUBS.libiao.row);
        pushEvent('⚠ BOTTLENECK DETECTED · Libiao 3D 소터 허용량 초과', 'danger');
        const waiting = w.groups.reduce(
          (n, g) => n + g.tokens.filter((t) => (t.phase === 'toSort' || t.phase === 'atSort') && t.sortHub === 'libiao').length,
          0
        );
        const backlog = waiting > 0 ? `분류 대기 ${waiting}건 적체` : '유입 대비 처리량 부족으로 적체 임박';
        story = {
          title: 'WCS 병목 대응',
          tone: 'danger',
          lines: [
            `Libiao 3D 소터 처리량 임계치 초과, ${backlog}`,
            'DAS 분류 라인 여유 용량 확인, 경로별 예상 지연 시간 산출',
            '총량피킹 물량을 DAS 라인으로 우회, 소터 부하 분산',
          ],
        };
        effect = (world) => {
          let rerouted = 0;
          world.groups = world.groups.map((group) => ({
            ...group,
            tokens: group.tokens.map((tk) => {
              if ((tk.phase === 'toSort' || tk.phase === 'atSort') && tk.sortHub === 'libiao') {
                rerouted += 1;
                return { ...tk, sortHub: 'das', to: tk.phase === 'toSort' ? sortHubPos('das') : tk.to, rerouted: true };
              }
              return tk;
            }),
          }));
          pushEvent(
            rerouted > 0
              ? `WCS OPTIMIZED · 대기 오더 ${rerouted}건 DAS 라인으로 우회 완료`
              : 'WCS OPTIMIZED · 총량피킹 물량 DAS 라인 우회 경로 적용',
            'ok'
          );
          world.optimizationEvents += 1;
          world.leadTimeReduction = Math.min(42, world.leadTimeReduction + randInt(3, 6));
        };
      } else if (kind === 'urgent') {
        const dock = pickDock(INBOUND_DOCKS);
        pushEvent('🔶 긴급 오더 수신, 당일 출고 마감 임박', 'urgent');
        story = {
          title: 'WCS 긴급 오더 대응',
          tone: 'urgent',
          lines: [
            `긴급 오더 수신, ${dock.method} 도크 도착. 당일 출고 마감 임박`,
            '표준 보관 경유 시 마감 초과, 하이클라이머 즉시 가용 재고 확인',
            '보관 단계 생략, 하이클라이머 하이패스로 우선 처리 지시',
          ],
        };
        effect = (world) => {
          world.urgentTokens = [
            ...world.urgentTokens,
            {
              id: nextId(),
              urgent: true,
              phase: 'toPicking',
              t: 0,
              from: { col: INBOUND_COL, row: dock.row },
              to: pickingLanePos('climber'),
            },
          ];
          world.optimizationEvents += 1;
          world.leadTimeReduction = Math.min(42, world.leadTimeReduction + 2);
          pushEvent('하이패스 배정 완료, 보관 단계 건너뛰고 피킹 직행', 'urgent');
        };
      } else {
        const dock = OUTBOUND_DOCKS[1];
        w.failure = { dockId: dock.id, until: w.simClock + FAILURE_DURATION_MS + MODAL_LOCKOUT_MS };
        pushEvent(`✖ ${dock.id} (${dock.method}) ERROR · 설비 정지`, 'danger');
        const stranded = [
          ...w.groups.flatMap((g) => g.tokens),
          ...w.palletShipments.flatMap((sh) => sh.tokens),
        ].filter((tk) => tk.dock?.id === dock.id && (tk.phase === 'toOutbound' || tk.phase === 'atOutbound')).length;
        story = {
          title: 'WCS 설비 고장 대응',
          tone: 'danger',
          lines: [
            stranded > 0
              ? `${dock.id} ${dock.method} 정지, 출고 대기 ${stranded}건 고립`
              : `${dock.id} ${dock.method} 정지, 해당 도크 배정 물량 처리 불가`,
            '잔여 출고 도크 2개 부하 비교, 재할당 경로 및 소요시간 산출',
            '고립 물량을 가용 도크로 재할당, 출고 중단 없이 라인 유지',
          ],
        };
        effect = (world) => {
          let rerouted = 0;
          const reroute = (tk) => {
            if (tk.dock?.id === dock.id && (tk.phase === 'toOutbound' || tk.phase === 'atOutbound')) {
              rerouted += 1;
              const altDock = OUTBOUND_DOCKS.find((d) => d.id !== dock.id);
              return { ...tk, dock: altDock, phase: 'toOutbound', t: 0, from: tk.to, to: outboundPos(altDock), rerouted: true };
            }
            return tk;
          };
          world.groups = world.groups.map((group) => ({ ...group, tokens: group.tokens.map(reroute) }));
          world.palletShipments = world.palletShipments.map((ship) => ({ ...ship, tokens: ship.tokens.map(reroute) }));
          pushEvent(
            rerouted > 0
              ? `WCS 경로 재탐색 · 출고 대기 물량 ${rerouted}건 재할당`
              : 'WCS 경로 재탐색 · 잔여 출고 도크로 배정 경로 전환',
            'ok'
          );
          world.optimizationEvents += 1;
          world.leadTimeReduction = Math.min(42, world.leadTimeReduction + randInt(2, 4));
        };
      }

      if (auto || w.story) enqueueStory(w, story, effect);
      else runDecisionModal(story, effect);
    },
    [pushEvent, flashPulse, runDecisionModal]
  );
  makeEventRef.current = makeEvent;

  const triggerBottleneck = useCallback(() => {
    if (triggerCooldown.bottleneck) return;
    fireCooldown('bottleneck', BOTTLENECK_DURATION_MS + MODAL_LOCKOUT_MS);
    makeEvent('bottleneck');
  }, [triggerCooldown, fireCooldown, makeEvent]);

  const triggerUrgent = useCallback(() => {
    if (triggerCooldown.urgent) return;
    fireCooldown('urgent', MODAL_LOCKOUT_MS + 2000);
    makeEvent('urgent');
  }, [triggerCooldown, fireCooldown, makeEvent]);

  const triggerFailure = useCallback(() => {
    if (triggerCooldown.failure) return;
    fireCooldown('failure', FAILURE_DURATION_MS + MODAL_LOCKOUT_MS);
    makeEvent('failure');
  }, [triggerCooldown, fireCooldown, makeEvent]);

  const reset = useCallback(() => {
    worldRef.current = freshWorld();
    pendingEffectRef.current = null;
    wasRunningRef.current = true;
    dashAtRef.current = 0;
    setEvents([]);
    setPulse(null);
    setRunning(true);
    setDash(buildDash(worldRef.current));
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
    callouts: snapshot.callouts,
    coreCaption: snapshot.coreCaption,
    dash,
    pulse,
    triggerCooldown,
    triggerBottleneck,
    triggerUrgent,
    triggerFailure,
    finishStory,
    reset,
  };
}

export { TOTAL_ORDERS, BATCH_SIZE, TOTAL_BATCHES };
