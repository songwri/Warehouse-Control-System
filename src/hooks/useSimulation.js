import { useCallback, useEffect, useRef, useState } from 'react';
import { LANES, STAGES, TOTAL_ORDERS, BATCH_SIZE, TOTAL_BATCHES } from '../data/equipment.js';

const TICK_MS = 100; // real-time tick
const STAGE_DURATION_MS = 2600; // sim-time to cross one stage at 1x
const STAGING_DURATION_MS = 1300; // grouping-cluster hold time at 1x
const BATCH_INTERVAL_MS = 12000; // sim-time between batch spawns at 1x
const BOTTLENECK_DURATION_MS = 6500;
const FAILURE_DURATION_MS = 7500;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function assignLane() {
  const r = Math.random();
  if (r < 0.35) return { lane: 'pcs', lineType: randInt(1, 4) };
  if (r < 0.7) return { lane: 'plt', lineType: randInt(1, 4) };
  return { lane: 'manual', lineType: randInt(5, 10) };
}

let idSeq = 1;
function nextId() {
  return idSeq++;
}

export default function useSimulation() {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [orders, setOrders] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [urgentCompleted, setUrgentCompleted] = useState(0);
  const [batchesSpawned, setBatchesSpawned] = useState(0);
  const [events, setEvents] = useState([]);
  const [metrics, setMetrics] = useState({
    throughputHistory: [{ t: 0, count: 0 }],
    optimizationEvents: 0,
    leadTimeReduction: 0,
  });
  const [bottleneck, setBottleneck] = useState(null); // { until }
  const [failure, setFailure] = useState(null); // { lane, until }
  const [triggerCooldown, setTriggerCooldown] = useState({});

  const simClockRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const metricSampleRef = useRef(0);
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  runningRef.current = running;
  speedRef.current = speed;

  const pushEvent = useCallback((text, tone = 'info') => {
    const id = nextId();
    setEvents((ev) => [...ev, { id, text, tone }]);
    setTimeout(() => {
      setEvents((ev) => ev.filter((e) => e.id !== id));
    }, 4800);
  }, []);

  // ---- main tick loop ----
  useEffect(() => {
    const iv = setInterval(() => {
      if (!runningRef.current) return;
      const dt = TICK_MS * speedRef.current;
      simClockRef.current += dt;
      spawnTimerRef.current += dt;
      metricSampleRef.current += dt;

      // batch spawn
      setBatchesSpawned((prevBatches) => {
        if (prevBatches < TOTAL_BATCHES && spawnTimerRef.current >= BATCH_INTERVAL_MS) {
          spawnTimerRef.current = 0;
          const batchId = prevBatches + 1;
          const releaseAt = simClockRef.current + STAGING_DURATION_MS;
          const newOrders = Array.from({ length: BATCH_SIZE }, () => {
            const { lane, lineType } = assignLane();
            return {
              id: nextId(),
              batchId,
              lane,
              originLane: lane,
              lineType,
              status: 'staging',
              stageIndex: 0,
              progress: 0,
              releaseAt: releaseAt + Math.random() * 500,
              urgent: false,
              speedMult: 0.82 + Math.random() * 0.42,
              staggerX: Math.random(),
              staggerY: Math.random(),
            };
          });
          setOrders((prev) => [...prev, ...newOrders]);
          pushEvent(`배치 #${batchId} 접수 — 오더 20건 WCS 그룹핑 시작`, 'info');
          return prevBatches + 1;
        }
        return prevBatches;
      });

      // bottleneck expiry
      setBottleneck((b) => (b && simClockRef.current >= b.until ? null : b));
      // failure expiry
      setFailure((f) => {
        if (f && simClockRef.current >= f.until) {
          pushEvent('출고 무인지게차 복구 완료 — 정상 라인으로 전환', 'ok');
          return null;
        }
        return f;
      });

      let justCompleted = 0;
      let justCompletedUrgent = 0;
      setOrders((prev) =>
        prev.map((o) => {
          if (o.status === 'done') return o;

          if (o.status === 'staging') {
            if (simClockRef.current >= o.releaseAt) {
              return { ...o, status: 'moving' };
            }
            return o;
          }

          // moving
          const stepPerMs = 1 / (STAGE_DURATION_MS / o.speedMult);
          let progress = o.progress + stepPerMs * dt;
          let stageIndex = o.stageIndex;
          let lane = o.lane;

          if (progress >= 1) {
            if (stageIndex >= STAGES.length - 1) {
              if (o.urgent) justCompletedUrgent += 1;
              else justCompleted += 1;
              return { ...o, status: 'done', progress: 1 };
            }
            stageIndex += 1;
            progress = 0;
          }

          return { ...o, stageIndex, progress, lane };
        })
      );
      if (justCompleted > 0) {
        setCompletedCount((c) => c + justCompleted);
      }
      if (justCompletedUrgent > 0) {
        setUrgentCompleted((c) => c + justCompletedUrgent);
      }

      if (metricSampleRef.current >= 1000) {
        metricSampleRef.current = 0;
        setMetrics((m) => {
          const hist = [...m.throughputHistory, { t: m.throughputHistory.length, count: completedCountRef.current }];
          return { ...m, throughputHistory: hist.slice(-30) };
        });
      }
    }, TICK_MS);
    return () => clearInterval(iv);
  }, [pushEvent]);

  // keep a ref mirror of completedCount for the metrics sampler above
  const completedCountRef = useRef(0);
  useEffect(() => {
    completedCountRef.current = completedCount;
  }, [completedCount]);

  // ---- triggers ----
  const fireCooldown = useCallback((key, ms) => {
    setTriggerCooldown((c) => ({ ...c, [key]: true }));
    setTimeout(() => setTriggerCooldown((c) => ({ ...c, [key]: false })), ms);
  }, []);

  const triggerBottleneck = useCallback(() => {
    if (triggerCooldown.bottleneck) return;
    fireCooldown('bottleneck', BOTTLENECK_DURATION_MS + 1500);
    const until = simClockRef.current + BOTTLENECK_DURATION_MS;
    setBottleneck({ until });
    pushEvent('⚠ BOTTLENECK DETECTED — Libiao 3D 소터 허용량 초과', 'danger');

    setTimeout(() => {
      let rerouted = 0;
      setOrders((prev) =>
        prev.map((o) => {
          if (o.status !== 'moving') return o;
          const nearPicking =
            (o.lane === 'plt' && o.stageIndex === 1 && o.progress > 0.2) ||
            (o.lane === 'plt' && o.stageIndex === 2 && o.progress < 0.85);
          if (nearPicking) {
            rerouted += 1;
            return { ...o, lane: 'manual', rerouted: true };
          }
          return o;
        })
      );
      pushEvent(`WCS OPTIMIZED — 대기 오더 ${rerouted}건 매뉴얼 라인으로 우회 완료`, 'ok');
      setMetrics((m) => ({
        ...m,
        optimizationEvents: m.optimizationEvents + 1,
        leadTimeReduction: Math.min(38, m.leadTimeReduction + randInt(3, 6)),
      }));
    }, 1400);
  }, [pushEvent, fireCooldown, triggerCooldown]);

  const triggerUrgent = useCallback(() => {
    if (triggerCooldown.urgent) return;
    fireCooldown('urgent', 3500);
    const order = {
      id: nextId(),
      batchId: 0,
      lane: 'pcs',
      originLane: 'pcs',
      lineType: 1,
      status: 'moving',
      stageIndex: 0,
      progress: 0,
      releaseAt: 0,
      urgent: true,
      speedMult: 3,
      staggerX: 0.5,
      staggerY: 0.5,
    };
    setOrders((prev) => [...prev, order]);
    pushEvent('🔶 긴급 오더 투입 — 하이클라이머 → 로봇암 하이패스 경로 배정', 'urgent');
    setMetrics((m) => ({
      ...m,
      optimizationEvents: m.optimizationEvents + 1,
      leadTimeReduction: Math.min(38, m.leadTimeReduction + 2),
    }));
  }, [pushEvent, fireCooldown, triggerCooldown]);

  const triggerFailure = useCallback(() => {
    if (triggerCooldown.failure) return;
    fireCooldown('failure', FAILURE_DURATION_MS + 1500);
    const until = simClockRef.current + FAILURE_DURATION_MS;
    setFailure({ lane: 'plt', until });
    pushEvent('✖ 출고 무인지게차(PLT 라인) ERROR — 설비 정지', 'danger');

    setTimeout(() => {
      let rerouted = 0;
      setOrders((prev) =>
        prev.map((o) => {
          if (o.status !== 'moving') return o;
          if (o.lane === 'plt' && o.stageIndex === 4) {
            rerouted += 1;
            return { ...o, lane: 'manual', rerouted: true };
          }
          return o;
        })
      );
      pushEvent(`WCS 경로 재탐색 — 출고 대기 물량 ${rerouted}건 일반 지게차로 재할당`, 'ok');
      setMetrics((m) => ({
        ...m,
        optimizationEvents: m.optimizationEvents + 1,
        leadTimeReduction: Math.min(38, m.leadTimeReduction + randInt(2, 4)),
      }));
    }, 1100);
  }, [pushEvent, fireCooldown, triggerCooldown]);

  // divert any newly-arriving PLT order at outbound while failure is active
  useEffect(() => {
    if (!failure) return;
    const iv = setInterval(() => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.status === 'moving' && o.lane === 'plt' && o.stageIndex === 4 && o.progress < 0.12) {
            return { ...o, lane: 'manual', rerouted: true };
          }
          return o;
        })
      );
    }, 200);
    return () => clearInterval(iv);
  }, [failure]);

  const reset = useCallback(() => {
    setOrders([]);
    setCompletedCount(0);
    setUrgentCompleted(0);
    setBatchesSpawned(0);
    setEvents([]);
    setMetrics({ throughputHistory: [{ t: 0, count: 0 }], optimizationEvents: 0, leadTimeReduction: 0 });
    setBottleneck(null);
    setFailure(null);
    simClockRef.current = 0;
    spawnTimerRef.current = 0;
    metricSampleRef.current = 0;
    setRunning(true);
  }, []);

  return {
    running,
    setRunning,
    speed,
    setSpeed,
    orders,
    completedCount,
    urgentCompleted,
    batchesSpawned,
    events,
    metrics,
    bottleneck,
    failure,
    triggerCooldown,
    triggerBottleneck,
    triggerUrgent,
    triggerFailure,
    reset,
  };
}

export { LANES, STAGES, TOTAL_ORDERS };
