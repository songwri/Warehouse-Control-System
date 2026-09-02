import { Fragment, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GRID_COLS, GRID_ROWS, DESIGN_W, DESIGN_H, isoPoint } from '../lib/iso.js';
import {
  ZONES,
  zoneOfCol,
  INBOUND_COL,
  INBOUND_DOCKS,
  STORAGE_BANDS,
  STORAGE_COL_RANGE,
  STORAGE_CAP_VISUAL,
  PICKING_COL_RANGE,
  PICKING_LANES,
  SORT_COL,
  SORT_HUBS,
  BYPASS_ROW,
  BYPASS_ROW_MAX,
  BYPASS_COLOR,
  PACKING_COL,
  PACKING_STATIONS,
  OUTBOUND_COL,
  OUTBOUND_DOCKS,
  LANE_COLOR,
} from '../data/floorplan.js';
import {
  VEHICLE_DURATIONS,
  CARGO_DURATIONS,
  GROUP_DURATIONS,
  PALLET_SHIP_DURATIONS,
  URGENT_DURATIONS,
  currentPos,
} from '../data/timings.js';
import useFitScale from '../hooks/useFitScale.js';
import { IsoFloor, IsoBuilding, IsoToken, IsoActor, PileStack, IsoLabel, Callout } from './IsoPrimitives.jsx';
import EquipIcon from './EquipIcon.jsx';

const GROUP_TYPE_COLOR = { bulk: '#60a5fa', discrete: '#c084fc' };
const PALLET_SHIP_COLOR = '#fb923c';
const VEHICLE_ICON = { robotArm: 'robot-arm', agv: 'forklift', manual: 'forklift' };

// WCS core sits dead-centre at the top of the board, overlooking every zone.
const CORE = { x: DESIGN_W / 2, y: 74 };

function bandOccupancy(row, storageCounts) {
  for (const [key, band] of Object.entries(STORAGE_BANDS)) {
    if (row >= band.rowRange[0] && row <= band.rowRange[1]) {
      const ratio = Math.min(1, (storageCounts[key] || 0) / STORAGE_CAP_VISUAL);
      return { band, key, ratio };
    }
  }
  return null;
}

export default function IsoWarehouse({
  vehicles,
  cargoUnits,
  inboundPile,
  storageCounts,
  groups,
  palletShipments,
  urgentTokens,
  pulse,
  bottleneck,
  failure,
  callouts,
  coreCaption,
}) {
  const [wrapRef, scale] = useFitScale(DESIGN_W, DESIGN_H);

  const tiles = useMemo(() => {
    const list = [];
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const zone = zoneOfCol(c);
        const checker = (c + r) % 2 === 0;
        const occ = zone.key === 'storage' ? bandOccupancy(r, storageCounts) : null;
        // Occupancy is ADDED to the checkerboard base, never replaces it, so
        // a full storage band darkens the floor without flattening the grid.
        const isBypass = zone.key === 'sort' && r <= BYPASS_ROW_MAX;
        const fill = (checker ? 0.17 : 0.08) + (occ ? occ.ratio * 0.32 : 0) + (isBypass ? 0.06 : 0);
        list.push({ col: c, row: r, color: isBypass ? BYPASS_COLOR : zone.color, fill });
      }
    }
    return list;
  }, [storageCounts]);

  const wcsCore = CORE;

  return (
    <div ref={wrapRef} className="relative flex-1 min-h-0 rounded-xl border border-slate-700/60 bg-ink-900/70 overflow-hidden">
      <div
        className="absolute"
        style={{
          left: '50%',
          top: 10,
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        <IsoFloor tiles={tiles} width={DESIGN_W} height={DESIGN_H} />

        {/* zone labels */}
        {ZONES.map((z) => (
          <IsoLabel key={z.key} col={(z.colRange[0] + z.colRange[1]) / 2} row={-1.6} elevation={30}>
            {z.label}
          </IsoLabel>
        ))}

        {/* express lane caption — sits inside the green bypass strip */}
        <div
          className="absolute whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-mono font-bold tracking-wide pointer-events-none"
          style={{
            left: isoPoint(SORT_COL - 2, BYPASS_ROW + 1, 20).x,
            top: isoPoint(SORT_COL - 2, BYPASS_ROW + 1, 20).y,
            transform: 'translate(-50%, -50%)',
            color: BYPASS_COLOR,
            borderColor: `${BYPASS_COLOR}66`,
            background: 'rgba(6,14,12,.86)',
            zIndex: 900,
          }}
        >
          직행 · 분류 미경유
        </div>

        {/* inbound vehicle docks — WCS decision #1: which vehicle method */}
        {INBOUND_DOCKS.map((d) => (
          <IsoBuilding key={d.id} col={1} row={d.row} width={86} elevation={44} borderColor="rgba(34,211,238,.4)">
            <EquipIcon name={VEHICLE_ICON[d.vehicle]} className="w-4 h-4 text-cyan-300" />
            <span className="text-[11px] text-slate-50 font-semibold leading-tight">{d.method}</span>
          </IsoBuilding>
        ))}

        {/* inbound staging pile — boxes/pallets accumulate before moving to storage */}
        {Object.entries(inboundPile || {}).map(([bandKey, count]) => (
          <PileStack
            key={`ipile-${bandKey}`}
            col={2}
            row={(STORAGE_BANDS[bandKey].rowRange[0] + STORAGE_BANDS[bandKey].rowRange[1]) / 2}
            count={count}
            color={LANE_COLOR[STORAGE_BANDS[bandKey].lane]}
            cap={bandKey === 'shuttle' ? 4 : 6}
            elevation={10}
          />
        ))}

        {/* storage band markers */}
        {Object.entries(STORAGE_BANDS).map(([key, band]) => (
          <IsoBuilding
            key={key}
            col={STORAGE_COL_RANGE[0] + 1}
            row={(band.rowRange[0] + band.rowRange[1]) / 2}
            width={128}
            elevation={40}
            borderColor={`${LANE_COLOR[band.lane]}55`}
          >
            <EquipIcon name={key === 'climber' ? 'climber' : key === 'shuttle' ? 'shuttle' : 'rack'} className="w-4 h-4" style={{ color: LANE_COLOR[band.lane] }} />
            <span className="text-[11px] text-slate-50 font-semibold leading-tight">{band.label}</span>
            <span className="text-[10px] font-mono text-slate-300">{storageCounts[key] || 0}건 보관중</span>
          </IsoBuilding>
        ))}
        {Object.entries(STORAGE_BANDS).map(([key, band]) => (
          <PileStack
            key={`spile-${key}`}
            col={STORAGE_COL_RANGE[0] + 3.4}
            row={(band.rowRange[0] + band.rowRange[1]) / 2}
            count={storageCounts[key] || 0}
            color={LANE_COLOR[band.lane]}
            cap={7}
            elevation={8}
          />
        ))}

        {/* picking lane markers — moved ahead of sort */}
        {Object.entries(PICKING_LANES).map(([key, lane]) => (
          <IsoBuilding
            key={key}
            col={PICKING_COL_RANGE[0] + 1}
            row={(lane.rowRange[0] + lane.rowRange[1]) / 2}
            width={132}
            elevation={42}
            borderColor="rgba(52,211,153,.4)"
          >
            <EquipIcon name={lane.icon} className="w-4 h-4 text-emerald-300" />
            <span className="text-[11px] text-slate-50 font-semibold leading-tight">{lane.label}</span>
            <span className="text-[9.5px] text-slate-400 leading-tight">{lane.sub}</span>
          </IsoBuilding>
        ))}

        {/* sort hubs — optional, only bulk (총량피킹) groups pass through */}
        {Object.entries(SORT_HUBS).map(([key, hub]) => {
          const isBottleneck = key === 'libiao' && !!bottleneck;
          return (
            <IsoBuilding
              key={key}
              col={SORT_COL}
              row={hub.row}
              width={104}
              elevation={54}
              borderColor={isBottleneck ? '#ef4444' : 'rgba(192,132,252,.5)'}
              glow="#ef4444"
              active={isBottleneck}
            >
              <EquipIcon name={hub.icon} className="w-5 h-5 text-purple-300" />
              <span className="text-[11.5px] text-slate-50 font-bold leading-tight">{hub.label}</span>
              {isBottleneck && <span className="text-[10px] font-mono font-bold text-red-400 blink-fast">BOTTLENECK</span>}
            </IsoBuilding>
          );
        })}

        {/* packing stations — auto/manual, 50/50 by order group */}
        {Object.entries(PACKING_STATIONS).map(([key, st]) => (
          <IsoBuilding key={key} col={PACKING_COL} row={st.row} width={92} elevation={44} borderColor="rgba(251,146,60,.4)">
            <EquipIcon name={st.icon} className="w-4 h-4 text-orange-300" />
            <span className="text-[11px] text-slate-50 font-semibold leading-tight">{st.label}</span>
          </IsoBuilding>
        ))}

        {/* outbound docks — pooled 1/3 each */}
        {OUTBOUND_DOCKS.map((d) => {
          const isFailed = failure && failure.dockId === d.id;
          return (
            <IsoBuilding key={d.id} col={OUTBOUND_COL} row={d.row} width={86} elevation={44} borderColor={isFailed ? '#ef4444' : 'rgba(245,158,11,.45)'} glow="#ef4444" active={isFailed}>
              {isFailed ? (
                <>
                  <EquipIcon name="error" className="w-4 h-4 text-slate-500 blink-fast" />
                  <span className="text-[10.5px] font-mono font-bold text-red-400 blink-fast">ERROR</span>
                </>
              ) : (
                <>
                  <EquipIcon name={VEHICLE_ICON[d.vehicle]} className="w-4 h-4 text-amber-300" />
                  <span className="text-[11px] text-slate-50 font-semibold leading-tight">{d.method}</span>
                </>
              )}
            </IsoBuilding>
          );
        })}

        {/* WCS AI core + decision ping — the line only ever fires for a
            real routing decision (never ambient/decorative motion), so
            when it appears it means "WCS just chose something". */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: DESIGN_W, height: DESIGN_H, zIndex: 9000 }}>
          <AnimatePresence>
            {pulse && (
              <motion.line
                key={pulse.key}
                x1={wcsCore.x}
                y1={wcsCore.y}
                x2={isoPoint(pulse.col, pulse.row).x}
                y2={isoPoint(pulse.col, pulse.row).y}
                stroke="#93c5fd"
                strokeWidth="2.5"
                strokeDasharray="3 6"
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.9, times: [0, 0.15, 0.75, 1] }}
              />
            )}
          </AnimatePresence>
        </svg>
        {pulse && (
          <motion.div
            key={`target-${pulse.key}`}
            className="absolute rounded-full border-2 border-accent-soft"
            style={{ left: isoPoint(pulse.col, pulse.row).x - 14, top: isoPoint(pulse.col, pulse.row).y - 14, width: 28, height: 28, zIndex: 9000 }}
            initial={{ opacity: 0.9, scale: 0.5 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 0.9 }}
          />
        )}
        {/* rotating scanner ring — the core reads as an always-on radar dish */}
        <div
          className="absolute rounded-full core-spin border-2 border-dashed border-accent-soft/35"
          style={{ left: wcsCore.x - 68, top: wcsCore.y - 68, width: 136, height: 136, zIndex: 9000 }}
        />
        <div className="absolute rounded-full pulse-ring border-2 border-accent-soft/60" style={{ left: wcsCore.x - 54, top: wcsCore.y - 54, width: 108, height: 108, zIndex: 9001 }} />
        {/* the core itself "pops" on every new decision (key = coreCaption.id
            remounts it) rather than just idly blinking, so its emphasis is
            tied to real reasoning, matching the caption text below it */}
        <motion.div
          key={coreCaption?.id || 'idle'}
          className="absolute rounded-full bg-gradient-to-br from-accent to-blue-700 flex items-center justify-center shadow-glow"
          style={{ left: wcsCore.x - 38, top: wcsCore.y - 38, width: 76, height: 76, zIndex: 9002 }}
          initial={{ scale: coreCaption ? 1.16 : 1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <EquipIcon name="brain" className="w-9 h-9 text-white" />
        </motion.div>
        <div
          className="absolute whitespace-nowrap text-[15px] font-display font-bold text-slate-100 tracking-[0.2em] pointer-events-none"
          style={{ left: wcsCore.x, top: wcsCore.y - 72, transform: 'translateX(-50%)', zIndex: 9002 }}
        >
          WCS AI CORE
        </div>
        {/* anchor div holds the centering transform, motion child holds the
            animation - see Callout for why they must not share an element */}
        <div
          className="absolute pointer-events-none"
          style={{ left: wcsCore.x, top: wcsCore.y + 52, transform: 'translateX(-50%)', zIndex: 9002 }}
        >
          {/* wait mode: an outgoing caption must clear before the next one
              mounts, otherwise the two stack and shove each other mid-fade */}
          <AnimatePresence mode="wait">
            {coreCaption && (
              <motion.div
                key={coreCaption.id}
                initial={{ opacity: 0, y: -6, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.92 }}
                transition={{ duration: 0.3 }}
                className="whitespace-nowrap rounded-lg border border-accent-soft/60 px-3.5 py-2 text-[12px] font-mono font-semibold text-accent-soft"
                style={{
                  background: 'rgba(6,9,15,.95)',
                  boxShadow: '0 6px 16px -6px rgba(0,0,0,.8), 0 0 14px -4px rgba(147,197,253,.5)',
                }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-soft mr-1.5 align-middle animate-pulse" />
                {coreCaption.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* "why" callouts — a floating reason above the storage building
            whenever stock arrives or gets pulled for a pick, so a viewer
            never has to guess what criteria routed a unit */}
        <AnimatePresence>
          {callouts.map((c) => (
            <Callout key={c.id} col={c.col} row={c.row} text={c.text} tone={c.tone} elevation={c.elevation} />
          ))}
        </AnimatePresence>

        {/* inbound vehicles (trucks classified by WCS into robot-arm / AGV / manual) */}
        {vehicles.map((v) => {
          const { col, row } = currentPos(v, VEHICLE_DURATIONS);
          const deciding = v.phase === 'arrived' || v.phase === 'analyzing';
          return <IsoActor key={v.id} col={col} row={row} icon="truck" color={deciding ? '#f59e0b' : '#94a3b8'} pulse={deciding} elevation={16} />;
        })}

        {/* cargo units traveling dock -> storage slot */}
        {cargoUnits.map((u) => {
          const { col, row } = currentPos(u, CARGO_DURATIONS);
          return (
            <IsoToken
              key={u.id}
              col={col}
              row={row}
              size={u.kind === 'pallet' ? 15 : 9}
              color={LANE_COLOR[STORAGE_BANDS[u.bandKey].lane]}
              elevation={14}
            />
          );
        })}

        {/* order-group tokens — picking -> optional sort -> packing -> outbound */}
        {groups.flatMap((group) =>
          group.tokens.map((tk) => {
            const { col, row } = currentPos(tk, GROUP_DURATIONS);
            return <IsoToken key={tk.id} col={col} row={row} color={GROUP_TYPE_COLOR[tk.groupType]} glow={tk.rerouted} elevation={18} />;
          })
        )}

        {/* shuttle pallet-unit shipments — storage -> packing -> outbound directly */}
        {palletShipments.flatMap((ship) =>
          ship.tokens.map((tk) => {
            const { col, row } = currentPos(tk, PALLET_SHIP_DURATIONS);
            return <IsoToken key={tk.id} col={col} row={row} size={14} color={PALLET_SHIP_COLOR} glow={tk.rerouted} elevation={18} />;
          })
        )}

        {/* urgent (hot) orders — oversized versus a normal order square and
            dragging a fading trail, so the hi-pass speed reads instantly */}
        {urgentTokens.map((tk) => {
          const dur = URGENT_DURATIONS[tk.phase] || 1;
          const { col, row } = currentPos(tk, URGENT_DURATIONS);
          return (
            <Fragment key={tk.id}>
              {[0.42, 0.28, 0.14].map((back, i) => {
                const p = currentPos({ ...tk, t: tk.t - back * dur }, URGENT_DURATIONS);
                return (
                  <IsoToken
                    key={`${tk.id}-trail${i}`}
                    col={p.col}
                    row={p.row}
                    size={10 + i * 3}
                    color="#f59e0b"
                    elevation={26}
                    z={1900}
                    opacity={0.16 + i * 0.14}
                  />
                );
              })}
              <IsoToken col={col} row={row} color="#f59e0b" glow size={20} elevation={26} />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
