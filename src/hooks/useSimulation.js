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
  laneInfo,
  INTEGRATED_ROWS,
  SORT_COL,
  SORT_HUBS,
  BYPASS_ROW,
  PACKING_COL,
  PACKING_STATIONS,
  OUTBOUND_COL,
  OUTBOUND_DOCKS,
  OFFMAP_OUT_COL,
  pickCargoType,
  assignStorageBand,
  pickDock,
  rowInBand,
  rowInLane,
  pickSortHub,
  pickPackMethod,
  randInt,
} from '../data/floorplan.js';
import {
  VEHICLE_DURATIONS, CARGO_DURATIONS, GROUP_DURATIONS, PALLET_SHIP_DURATIONS, URGENT_DURATIONS,
  phaseDuration, PICK_SPEED, SORT_SPEED, PACK_SPEED, STORE_SPEED,
} from '../data/timings.js';
import {
  todayLabel,
  planTerminalLines,
  planDecisionLines,
  planAllocationChips,
  releaseTerminalLines,
  ALLOCATION_CANDIDATES,
  buildReleases,
  INCIDENT_SCRIPTS,
  WAVE_1,
  WAVE_2,
} from '../data/demoScript.js';

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
const GROUP_RELEASE_MS = 3400; // minimum sim-time between order groups leaving for the floor

// Picking lanes climber/amr/dpc/dps all draw from a storage band; climber
// serves its own PCS stock, the other three pull general-rack stock.
const LANE_SOURCE_BAND = { climber: 'climber', amr: 'rack', dpc: 'rack', dps: 'rack' };

let idSeq = 1;
const nextId = () => idSeq++;

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
    wmsNextThreshold: 0,
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
    vehicleSpawnTimer: 0,
    wmsTimer: 0,
    metricSample: 0,
    bottleneck: null,
    failure: null,
    story: null,
    storyQueue: [],
    storyGroupingShown: false,
    firstInboundDone: false,
    wavesStarted: 0,
    closing: false,
    finished: false,
    callouts: [],
    coreCaption: null,
    autoEventAt: randInt(AUTO_EVENT_MIN_MS, AUTO_EVENT_MAX_MS),
    // The scripted executive walkthrough. `demoStep` is the only thing that
    // advances it, and each step ends by queueing the next, so the sequence
    // can never run two beats at once or race the ambient simulation.
    demoStep: 'greeting',
    demoTimer: 0,
    // the plan currently on the floor, and what is left of it to release
    wavePlan: null,
    waveQueue: [],
    waveStoryShown: false,
    groupReleaseTimer: 0,
    // Running ledger of every routing call WCS makes - shown as live counters
    // instead of a text feed that scrolls faster than anyone can read.
    counts: { inbound: 0, storage: 0, order: 0, grouping: 0, picking: 0, sorting: 0, packing: 0, outbound: 0 },
  };
}

// ---- scripted opening --------------------------------------------------
// Beats run strictly one after another. Each one either queues a cinematic
// (which freezes the board until the viewer or the timer ends it) or waits
// out a timer, then names the next beat. Nothing here starts a timer that
// could still be running when the following beat begins, which is what keeps
// the ambient simulation and the script from stepping on each other.
// The walkthrough is about OUTBOUND. Goods receipt still runs on the floor,
// but it no longer gets a cinematic of its own: the room is here to watch
// what happens to an order book, and three beats about how a truck was
// unloaded pushed that story eight seconds further away.
const DEMO_HOLD = { greeting: 0, gapBeforeCutoff: 7000, gapBeforeWave2: 15000 };

function advanceDemo(w, dt, enqueue) {
  if (w.demoStep === 'done') return;
  // a cinematic is on screen: the script waits for it, by definition
  if (w.story || w.storyQueue.length) return;

  w.demoTimer += dt;
  const step = w.demoStep;
  const hold = DEMO_HOLD[step] ?? 0;
  if (w.demoTimer < hold) return;
  w.demoTimer = 0;

  if (step === 'greeting') {
    enqueue(w, {
      kind: 'banner',
      tone: 'info',
      title: `LX님, ${todayLabel()} 물류센터 가동을 시작합니다`,
      caption: '입고 라인 가동 중. 출고 오더가 접수되면 WCS가 전 공정을 실시간으로 판단합니다',
    });
    w.demoStep = 'gapBeforeCutoff';
  } else if (step === 'gapBeforeCutoff') {
    startWave(w, enqueue, WAVE_1, '전일 주문이 마감되었습니다. 분석을 시작합니다');
    w.demoStep = 'gapBeforeWave2';
  } else if (step === 'gapBeforeWave2') {
    startWave(w, enqueue, WAVE_2, '오후 오더를 마감합니다. 분석을 시작합니다');
    w.demoStep = 'done';
  }
}

// Announce a wave, show the analysis that produced its plan, then load that
// plan onto the floor. The releases are built here, so what the terminal
// prints and what the floor then does come from the same object.
function startWave(w, enqueue, plan, opening) {
  enqueue(w, {
    kind: 'banner',
    tone: 'urgent',
    title: opening,
    caption: `총 ${plan.total.toLocaleString()}건의 출고 오더가 일괄 접수되었습니다`,
  });
  // Same shape as the inbound decision: 상황 인지 opens the analysis
  // terminal, 대안 탐색 opens the comparison of allocation strategies, and
  // 최적 결정 commits. It was a bare terminal beat, which showed the plan
  // without ever showing WCS deciding on it.
  enqueue(
    w,
    {
      title: `WCS ${plan.title} 작업 할당`,
      tone: 'info',
      terminal: { title: `${plan.title} 분석 및 작업 할당`, lines: planTerminalLines(plan), typed: true, rate: 0.5 },
      options: ALLOCATION_CANDIDATES,
      allocation: planAllocationChips(plan),
      lines: planDecisionLines(plan),
    },
    (world) => {
      const laneTotal = (key) =>
        key === 'shuttle'
          ? plan.pallet
          : (plan.stations.find((st) => st.key === key)?.orders ?? 0);
      world.wavePlan = { ...plan, laneTotal };
      world.waveQueue = buildReleases(plan);
      world.waveStoryShown = false;
      world.wmsOrdersSpawned += plan.total;
      world.wmsPendingCount = plan.total;
      world.counts = { ...world.counts, order: world.counts.order + plan.total };
      world.groupReleaseTimer = GROUP_RELEASE_MS;
      world.wavesStarted += 1;
    },
  );
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
  const elevation = 100 + Math.min(sameSpot.length, 1) * 44;
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
  // the integrated band works its own stock in place rather than travelling
  // to a picking station, so its "picking position" stays in its own rows
  return { col: PICKING_COL_RANGE[0] + 1.4, row: rowInLane(laneInfo(lane)) };
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

// Where a band's "why" chip hangs. The three storage buildings sit within two
// columns of each other while their chips are several times wider, so anchored
// on the buildings themselves the chips crossed each other and the dock cards
// behind them. Fanning them out along the column axis gives each band its own
// lane without moving the buildings.
const CALLOUT_LANE = { climber: 3.4, shuttle: 0, rack: -3.4 };
function storageCalloutPos(bandKey) {
  const at = storageBuildingPos(bandKey);
  return { col: at.col + (CALLOUT_LANE[bandKey] || 0), row: at.row };
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
    finished: w.finished,
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

      // -- scripted opening drives what the floor is allowed to do yet --
      advanceDemo(w, dt, enqueueStory);
      const inboundUnlocked = w.demoStep !== 'greeting';
      const ordersUnlocked = false; // orders arrive as scripted waves, not on a drip

      if (inboundUnlocked) w.vehicleSpawnTimer += dt;
      if (ordersUnlocked) w.wmsTimer += dt;
      w.metricSample += dt;

      // ============ INBOUND: WCS decision #1 - vehicle classification ============
      if (w.vehicleSpawnTimer >= VEHICLE_SPAWN_INTERVAL_MS) {
        w.vehicleSpawnTimer = 0;
        const busyDockIds = new Set(w.vehicles.map((v) => v.dock.id));
        const freeDocks = INBOUND_DOCKS.filter((d) => !busyDockIds.has(d.id));
        if (freeDocks.length) {
          // The scripted opening has just announced that WCS assigned this
          // load to the robot arm, so the truck that rolls in next has to be
          // the robot arm's. Picking at random here let the very first
          // vehicle drive to the manual dock, contradicting the decision the
          // room had watched WCS make ten seconds earlier.
          const scripted = !w.firstInboundDone
            ? freeDocks.find((d) => d.vehicle === 'robotArm')
            : null;
          if (scripted) w.firstInboundDone = true;
          const dock = scripted || freeDocks[randInt(0, freeDocks.length - 1)];
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
        if (t < phaseDuration(VEHICLE_DURATIONS, v.phase, v.speed)) {
          nextVehicles.push({ ...v, t });
          continue;
        }
        if (v.phase === 'arriving') {
          const dockPos = { col: INBOUND_COL, row: v.dock.row };
          nextVehicles.push({ ...v, phase: 'arrived', t: 0, from: dockPos, to: dockPos });
        } else if (v.phase === 'arrived') {
          const cargoType = pickCargoType(v.dock);
          const bandKey = assignStorageBand(cargoType);
          const bandPos = storageBuildingPos(bandKey);
          const cargoLabel = cargoType === 'pallet' ? '팔레트' : '박스';
          pushEvent(
            `${v.dock.method} 도크 입고, ${cargoLabel} 판정 · ${STORAGE_BANDS[bandKey].label} 배정`,
            'info'
          );
          flashPulse(bandPos.col, bandPos.row);
          setCoreCaption(w, `판단: ${v.dock.method} 입고 → ${STORAGE_BANDS[bandKey].label} 배정`);
          w.counts = { ...w.counts, inbound: w.counts.inbound + 1 };
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
        if (t < phaseDuration(CARGO_DURATIONS, u.phase, u.speed)) {
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
          const bPos = storageCalloutPos(u.bandKey);
          addCallout(w, bPos.col, bPos.row, `+1 ${u.vehicleMethod}`, 'ok');
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

      w.groupReleaseTimer += dt;
      if (w.waveQueue.length && w.groupReleaseTimer >= GROUP_RELEASE_MS) {
        w.groupReleaseTimer = 0;
        const rel = w.waveQueue[0];
        w.waveQueue = w.waveQueue.slice(1);
        w.wmsPendingCount = Math.max(0, w.wmsPendingCount - rel.size);
        const groupId = w.wmsGroupsFormed + 1;
        w.wmsGroupsFormed = groupId;

        // A release names its own destination, so every token in the group
        // goes where the plan said it would. `integrated` work sorts inside
        // the box/pcs band and skips the sorters; `bulk` must be sorted after
        // picking; `discrete` is already order-level and runs the express row.
        const lane = rel.lane;
        const groupType = rel.flow === 'discrete' ? 'discrete' : 'bulk';
        const sourceBand = LANE_SOURCE_BAND[lane] || 'shuttle';

        // Staggered negative `t` (like cargo units) so the group's tokens
        // don't move in lockstep as one indistinguishable clump - each
        // order visibly departs storage and arrives at picking on its own.
        const tokens = Array.from({ length: GROUP_TOKENS_PER_GROUP }).map((_, i) => ({
          id: nextId(),
          lane,
          groupType,
          phase: 'toPicking',
          t: -i * 480,
          from: storageSourcePos(sourceBand),
          to: pickingLanePos(lane),
          sourceBand,
          rerouted: false,
        }));
        w.groups = [...w.groups, { id: groupId, type: groupType, size: rel.size, tokens, doneCount: 0 }];

        const routeText =
          rel.flow === 'integrated'
            ? '통합 처리, 분류 미경유로 포장 직행'
            : rel.flow === 'discrete'
              ? '오더피킹 판정, 분류 미경유 직행 레인'
              : '총량피킹 판정, 분류 설비 경유 후 포장';
        const remaining = w.waveQueue.reduce((n, r) => n + r.size, 0);

        flashPulse(pickingLanePos(lane).col, pickingLanePos(lane).row);
        setCoreCaption(w, `판단: OG-${groupId} ${rel.size}건 → ${rel.label} 배정`);
        w.counts = { ...w.counts, grouping: w.counts.grouping + 1 };

        // The grouping decision is explained once per wave. After that the
        // mechanism is known and the room should be watching work move, not
        // reading the same three lines fourteen more times.
        if (!w.waveStoryShown) {
          w.waveStoryShown = true;
          const plan = w.wavePlan;
          enqueueStory(w, {
            title: `WCS 오더 그룹핑 의사결정 · OG-${groupId}`,
            tone: 'info',
            // same three-window shape as every other decision: 상황 인지
            // opens the terminal, 대안 탐색 opens the route comparison
            terminal: {
              title: `OG-${groupId} 편성 분석`,
              lines: releaseTerminalLines(plan, rel, remaining),
            },
            options: [
              ...plan.stations.map((st) => ({
                key: st.key,
                label: st.label,
                note: `배정 ${st.orders.toLocaleString()}건`,
                chosen: st.key === lane,
              })),
              {
                key: 'shuttle',
                label: '팔레트 보관자동화',
                note: `배정 ${plan.pallet.toLocaleString()}건`,
                chosen: lane === 'shuttle',
              },
            ].slice(0, 4),
            lines: [
              `${plan.title} ${plan.total.toLocaleString()}건 중 ${rel.label} 배정분 ${plan.laneTotal(lane).toLocaleString()}건 확인`,
              `설비 가용 능력 기준 분할, OG-${groupId} ${rel.size}건 편성. 잔여 ${remaining.toLocaleString()}건`,
              `${rel.label} 작업 지시 하달. ${routeText}`,
            ],
          });
        } else {
          pushEvent(`OG-${groupId} ${rel.size}건 편성, ${rel.label} 배정 · 잔여 ${remaining.toLocaleString()}건`, 'info');
        }
      }

      // -- advance order-group tokens --
      const nextGroups = [];
      for (let group of w.groups) {
        let doneDelta = 0;
        const nextTokens = [];
        for (const tk of group.tokens) {
          const t = tk.t + dt;
          if (t < phaseDuration(GROUP_DURATIONS, tk.phase, tk.speed)) {
            nextTokens.push({ ...tk, t });
            continue;
          }
          if (tk.phase === 'toPicking') {
            nextTokens.push({ ...tk, phase: 'atPicking', t: 0, speed: PICK_SPEED[tk.lane] || 1 });
          } else if (tk.phase === 'atPicking') {
            w.storageCounts = { ...w.storageCounts, [tk.sourceBand]: Math.max(0, (w.storageCounts[tk.sourceBand] || 0) - 1) };
            const srcPos = storageCalloutPos(tk.sourceBand);
            addCallout(w, srcPos.col, srcPos.row, `-1 ${laneInfo(tk.lane).label}`, 'urgent');
            const fromPos = pickingLanePos(tk.lane);
            w.counts = { ...w.counts, picking: w.counts.picking + 1 };
            if (tk.lane === 'climber') {
              // The integrated band sorts inside itself, so its work touches
              // no other machine: straight from here to packing, which is the
              // whole point of drawing that band as one continuous cell.
              const packMethod = pickPackMethod();
              nextTokens.push({
                ...tk,
                phase: 'toPacking',
                t: 0,
                from: fromPos,
                to: packingPos(packMethod),
                packMethod,
                speed: PACK_SPEED[packMethod],
              });
            } else if (tk.groupType === 'bulk') {
              // While a sorter bottleneck is live, WCS keeps steering *new*
              // bulk work to DAS too - not just the batch already queued.
              const sortHub = w.bottleneck ? 'das' : pickSortHub();
              w.counts = { ...w.counts, sorting: w.counts.sorting + 1 };
              nextTokens.push({ ...tk, phase: 'toSort', t: 0, from: fromPos, to: sortHubPos(sortHub), sortHub, rerouted: !!w.bottleneck, speed: SORT_SPEED[sortHub] });
            } else {
              // Order-picked work runs the express strip over the sorters so
              // "no sort needed" is a visible route, not an invisible skip.
              nextTokens.push({ ...tk, phase: 'toBypass', t: 0, from: fromPos, to: bypassPos() });
            }
          } else if (tk.phase === 'toBypass') {
            const packMethod = pickPackMethod();
            w.counts = { ...w.counts, packing: w.counts.packing + 1 };
            nextTokens.push({ ...tk, phase: 'toPacking', t: 0, from: bypassPos(), to: packingPos(packMethod), packMethod, speed: PACK_SPEED[packMethod] });
          } else if (tk.phase === 'toSort') {
            nextTokens.push({ ...tk, phase: 'atSort', t: 0 });
          } else if (tk.phase === 'atSort') {
            const packMethod = pickPackMethod();
            w.counts = { ...w.counts, packing: w.counts.packing + 1 };
            nextTokens.push({ ...tk, phase: 'toPacking', t: 0, from: sortHubPos(tk.sortHub), to: packingPos(packMethod), packMethod, speed: PACK_SPEED[packMethod] });
          } else if (tk.phase === 'toPacking') {
            nextTokens.push({ ...tk, phase: 'atPacking', t: 0 });
          } else if (tk.phase === 'atPacking') {
            const failedDockId = w.failure?.dockId;
            let dock = pickDock(OUTBOUND_DOCKS);
            if (failedDockId && dock.id === failedDockId) dock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId) || dock;
            w.counts = { ...w.counts, outbound: w.counts.outbound + 1 };
            nextTokens.push({ ...tk, phase: 'toOutbound', t: 0, from: packingPos(tk.packMethod), to: outboundPos(dock), dock, speed: 1, legOrder: 'row' });
          } else if (tk.phase === 'toOutbound') {
            const failedDockId = w.failure?.dockId;
            if (failedDockId && tk.dock?.id === failedDockId) {
              const altDock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId);
              nextTokens.push({ ...tk, phase: 'toOutbound', t: 0, from: tk.to, to: outboundPos(altDock), dock: altDock, rerouted: true, legOrder: 'row' });
            } else {
              nextTokens.push({ ...tk, phase: 'atOutbound', t: 0 });
            }
          } else if (tk.phase === 'atOutbound') {
            w.sampleOut += 1;
            doneDelta += 1;
            nextTokens.push({
              ...tk,
              phase: 'departing',
              t: 0,
              from: outboundPos(tk.dock),
              to: { col: OFFMAP_OUT_COL, row: tk.dock.row },
              speed: 1,
            });
          } else if (tk.phase !== 'departing') {
            nextTokens.push(tk);
          }
        }
        const doneCount = group.doneCount + doneDelta;
        if (doneDelta > 0 && doneCount >= GROUP_TOKENS_PER_GROUP && !group.counted) {
          w.completedCount = Math.min(TOTAL_ORDERS, w.completedCount + group.size);
          pushEvent(`OG-${group.id} 출고 완료, ${group.size}건 발송`, 'ok');
          group = { ...group, counted: true };
        }
        // The group is counted the moment its last token reaches the dock,
        // but it is not dropped until every token has driven off the map -
        // otherwise the departure leg would be deleted before it plays.
        if (nextTokens.length) nextGroups.push({ ...group, tokens: nextTokens, doneCount });
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
            speed: PACK_SPEED[packMethod],
            rerouted: false,
          };
        });
        w.palletShipments = [...w.palletShipments, { id: shipId, size: PALLET_SHIP_THRESHOLD, tokens, doneCount: 0 }];
        pushEvent(`팔레트 보관자동화 출고그룹 편성 ${PALLET_SHIP_THRESHOLD}건, 포장 후 즉시 출고`, 'info');
        flashPulse(PACKING_COL, 6);
        setCoreCaption(w, `판단: 팔레트 보관자동화 ${PALLET_SHIP_THRESHOLD}건 → 즉시 출고`);
        const shuttlePos = storageBuildingPos('shuttle');
        addCallout(w, shuttlePos.col, shuttlePos.row, `-${PALLET_SHIP_THRESHOLD} 팔레트 직송`, 'urgent');
      }

      const nextShipments = [];
      for (let ship of w.palletShipments) {
        let doneDelta = 0;
        const nextTokens = [];
        for (const tk of ship.tokens) {
          const t = tk.t + dt;
          if (t < phaseDuration(PALLET_SHIP_DURATIONS, tk.phase, tk.speed)) {
            nextTokens.push({ ...tk, t });
            continue;
          }
          if (tk.phase === 'toPacking') {
            nextTokens.push({ ...tk, phase: 'atPacking', t: 0 });
          } else if (tk.phase === 'atPacking') {
            const failedDockId = w.failure?.dockId;
            let dock = pickDock(OUTBOUND_DOCKS);
            if (failedDockId && dock.id === failedDockId) dock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId) || dock;
            nextTokens.push({ ...tk, phase: 'toOutbound', t: 0, from: packingPos(tk.packMethod), to: outboundPos(dock), dock, speed: 1, legOrder: 'row' });
          } else if (tk.phase === 'toOutbound') {
            const failedDockId = w.failure?.dockId;
            if (failedDockId && tk.dock?.id === failedDockId) {
              const altDock = OUTBOUND_DOCKS.find((d) => d.id !== failedDockId);
              nextTokens.push({ ...tk, phase: 'toOutbound', t: 0, from: tk.to, to: outboundPos(altDock), dock: altDock, rerouted: true, legOrder: 'row' });
            } else {
              nextTokens.push({ ...tk, phase: 'atOutbound', t: 0 });
            }
          } else if (tk.phase === 'atOutbound') {
            w.sampleOut += 1;
            doneDelta += 1;
            nextTokens.push({
              ...tk,
              phase: 'departing',
              t: 0,
              from: outboundPos(tk.dock),
              to: { col: OFFMAP_OUT_COL, row: tk.dock.row },
              speed: 1,
            });
          } else if (tk.phase !== 'departing') {
            nextTokens.push(tk);
          }
        }
        const doneCount = ship.doneCount + doneDelta;
        if (doneDelta > 0 && doneCount >= PALLET_SHIP_TOKENS && !ship.counted) {
          w.palletCompleted += ship.size;
          pushEvent(`팔레트 출고그룹 #${ship.id} 완료, ${ship.size}건 발송`, 'ok');
          ship = { ...ship, counted: true };
        }
        if (nextTokens.length) nextShipments.push({ ...ship, tokens: nextTokens, doneCount });
      }
      w.palletShipments = nextShipments;

      // -- advance urgent tokens (skip storage entirely, climber high-pass) --
      const nextUrgent = [];
      for (const tk of w.urgentTokens) {
        const t = tk.t + dt;
        if (t < phaseDuration(URGENT_DURATIONS, tk.phase, tk.speed)) {
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
          nextUrgent.push({
            ...tk,
            phase: 'departing',
            t: 0,
            from: tk.to,
            to: { col: OFFMAP_OUT_COL, row: tk.to.row },
          });
        } else if (tk.phase !== 'departing') nextUrgent.push(tk);
      }
      w.urgentTokens = nextUrgent;

      // -- the day closes once both books are through the building --
      if (
        !w.closing &&
        w.demoStep === 'done' &&
        w.wavesStarted >= 2 &&
        !w.waveQueue.length &&
        !w.groups.length &&
        !w.palletShipments.length &&
        !w.urgentTokens.length &&
        !w.story &&
        !w.storyQueue.length
      ) {
        w.closing = true;
        enqueueStory(w, {
          kind: 'banner',
          tone: 'info',
          title: '금일 업무를 마감합니다',
          caption: `출고 완료 ${(w.completedCount + w.palletCompleted).toLocaleString()}건 · 무중단 처리`,
        });
        enqueueStory(
          w,
          {
            kind: 'banner',
            tone: 'info',
            title: '학습정보와 비학습정보를 구분하여 관리합니다',
            caption: '금일 판단 이력은 학습 대상으로 분류되어 익일 배부 기준에 반영됩니다',
          },
          (world) => {
            world.finished = true;
          },
        );
      }

      // -- incidents fire on their own, the way they do on a real floor --
      if (w.demoStep === 'done' && !w.closing && w.simClock >= w.autoEventAt && !w.story && !w.storyQueue.length) {
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
        pushEvent(`${w.failure.dockMethod} 도크 복구 완료, 정상 라인으로 전환`, 'ok');
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
        pushEvent('분류 병목 감지, AGV(로봇) 허용량 초과', 'danger');
        const waiting = w.groups.reduce(
          (n, g) => n + g.tokens.filter((t) => (t.phase === 'toSort' || t.phase === 'atSort') && t.sortHub === 'libiao').length,
          0
        );
        const backlog = waiting > 0 ? `분류 대기 ${waiting}건 적체` : '유입 대비 처리량 부족으로 적체 임박';
        story = {
          title: 'WCS 병목 대응',
          tone: 'danger',
          lines: [
            `AGV(로봇) 처리량 임계치 초과, ${backlog}`,
            'DAS(컨베이어) 여유 용량 확인, 경로별 예상 지연 시간 산출',
            '총량피킹 물량을 DAS(컨베이어)로 우회, 분류 부하 분산',
          ],
          options: INCIDENT_SCRIPTS.bottleneck.options,
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
              ? `최적화 완료, 대기 오더 ${rerouted}건 DAS(컨베이어)로 우회`
              : '최적화 완료, 총량피킹 물량 DAS(컨베이어) 우회 경로 적용',
            'ok'
          );
          world.optimizationEvents += 1;
          world.leadTimeReduction = Math.min(42, world.leadTimeReduction + randInt(3, 6));
        };
      } else if (kind === 'urgent') {
        const dock = pickDock(INBOUND_DOCKS);
        pushEvent('긴급 오더 수신, 당일 출고 마감 임박', 'urgent');
        story = {
          title: 'WCS 긴급 오더 대응',
          tone: 'urgent',
          lines: [
            `긴급 오더 수신, ${dock.method} 도크 도착. 당일 출고 마감 임박`,
            '표준 보관 경유 시 마감 초과, 박스/pcs 보관자동화 즉시 가용 재고 확인',
            '보관 단계 생략, 박스/pcs 보관자동화 하이패스로 우선 처리 지시',
          ],
          options: INCIDENT_SCRIPTS.urgent.options,
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
        w.failure = { dockId: dock.id, dockMethod: dock.method, until: w.simClock + FAILURE_DURATION_MS + MODAL_LOCKOUT_MS };
        pushEvent(`${dock.method} 출고 설비 정지`, 'danger');
        const stranded = [
          ...w.groups.flatMap((g) => g.tokens),
          ...w.palletShipments.flatMap((sh) => sh.tokens),
        ].filter((tk) => tk.dock?.id === dock.id && (tk.phase === 'toOutbound' || tk.phase === 'atOutbound')).length;
        story = {
          title: 'WCS 설비 고장 대응',
          tone: 'danger',
          lines: [
            stranded > 0
              ? `${dock.method} 출고 설비 정지, 출고 대기 ${stranded}건 고립`
              : `${dock.method} 출고 설비 정지, 해당 도크 배정 물량 처리 불가`,
            '잔여 출고 도크 2개 부하 비교, 재할당 경로 및 소요시간 산출',
            '고립 물량을 가용 도크로 재할당, 출고 중단 없이 라인 유지',
          ],
          options: OUTBOUND_DOCKS.map((d, i) => ({
            key: d.id,
            label: `${d.method} 도크`,
            note: d.id === dock.id ? '정지, 배정 불가' : i === 0 ? '가용, 부하 낮음' : '가용',
            chosen: d.id !== dock.id && OUTBOUND_DOCKS.findIndex((x) => x.id !== dock.id) === i,
          })),
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

      // Every incident is narrated the same way the scheduled work is: WCS
      // says what it has seen, shows its working in the terminal, commits to
      // a decision, and afterwards says what it took away from it. Queueing
      // all four beats (rather than playing the first immediately) keeps them
      // in order, since the queue only ever runs one cinematic at a time.
      const script = INCIDENT_SCRIPTS[kind];
      if (script) {
        enqueueStory(w, { kind: 'banner', tone: script.tone, title: script.opening });
        enqueueStory(
          w,
          { ...story, terminal: { title: script.terminalTitle, lines: script.lines } },
          effect,
        );
        enqueueStory(w, {
          kind: 'banner',
          tone: 'info',
          title: 'WCS 학습 완료',
          caption: script.learned,
        });
      } else if (auto || w.story) {
        enqueueStory(w, story, effect);
      } else {
        runDecisionModal(story, effect);
      }
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
    finished: snapshot.finished,
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
