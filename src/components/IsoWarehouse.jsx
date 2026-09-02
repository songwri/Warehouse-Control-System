import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GRID_COLS, GRID_ROWS, DESIGN_W, DESIGN_H, isoPoint } from '../lib/iso.js';
import {
  ZONES,
  zoneOfCol,
  INBOUND_DOCKS,
  STORAGE_BANDS,
  STORAGE_COL_RANGE,
  STORAGE_CAP_VISUAL,
  SORT_COL,
  SORT_ROW,
  PICKING_COL_RANGE,
  PICKING_LANES,
  OUTBOUND_COL,
  OUTBOUND_DOCKS,
  LANE_COLOR,
} from '../data/floorplan.js';
import { INBOUND_DURATIONS, BATCH_DURATIONS, URGENT_DURATIONS, currentPos } from '../data/timings.js';
import useFitScale from '../hooks/useFitScale.js';
import { IsoTile, IsoBuilding, IsoToken, IsoLabel } from './IsoPrimitives.jsx';
import EquipIcon from './EquipIcon.jsx';

function shadeFor(col, row) {
  const zone = zoneOfCol(col);
  const checker = (col + row) % 2 === 0;
  return { zone, opacity: checker ? 0.16 : 0.09 };
}

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
  inboundItems,
  batches,
  urgentTokens,
  storageCounts,
  pulse,
  bottleneck,
  failure,
  running,
}) {
  const [wrapRef, scale] = useFitScale(DESIGN_W, DESIGN_H);
  const [ambient, setAmbient] = useState(null);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      const band = Object.values(STORAGE_BANDS)[Math.floor(Math.random() * 3)];
      const col = STORAGE_COL_RANGE[0] + Math.random() * (STORAGE_COL_RANGE[1] - STORAGE_COL_RANGE[0]);
      const row = band.rowRange[0] + Math.random() * (band.rowRange[1] - band.rowRange[0]);
      setAmbient({ col, row, key: Date.now() });
    }, 1400);
    return () => clearInterval(iv);
  }, [running]);

  const tiles = useMemo(() => {
    const list = [];
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const { zone, opacity } = shadeFor(c, r);
        let color = zone.color;
        const occ = zone.key === 'storage' ? bandOccupancy(r, storageCounts) : null;
        list.push(
          <IsoTile
            key={`${c}-${r}`}
            col={c}
            row={r}
            color={color}
            opacity={occ ? Math.max(opacity, occ.ratio * 0.55) : opacity}
          />
        );
      }
    }
    return list;
  }, [storageCounts]);

  const wcsCore = isoPoint(SORT_COL, SORT_ROW, 150);

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
        {tiles}

        {/* zone labels */}
        {ZONES.map((z) => (
          <IsoLabel key={z.key} col={(z.colRange[0] + z.colRange[1]) / 2} row={-1.6} elevation={0} dim>
            {z.label}
          </IsoLabel>
        ))}

        {/* inbound dock buildings */}
        {INBOUND_DOCKS.map((d) => (
          <IsoBuilding key={d.id} col={1} row={d.row} width={86} elevation={44} borderColor="rgba(34,211,238,.4)">
            <EquipIcon name={d.auto ? 'auto-in' : 'manual-in'} className="w-4 h-4 text-cyan-300" />
            <span className="text-[9.5px] text-slate-200 font-medium leading-tight">{d.method}</span>
          </IsoBuilding>
        ))}

        {/* storage band markers */}
        {Object.entries(STORAGE_BANDS).map(([key, band]) => (
          <IsoBuilding
            key={key}
            col={STORAGE_COL_RANGE[0] + 1}
            row={(band.rowRange[0] + band.rowRange[1]) / 2}
            width={112}
            elevation={40}
            borderColor={`${LANE_COLOR[band.lane]}55`}
          >
            <EquipIcon name={key === 'climber' ? 'climber' : key === 'shuttle' ? 'shuttle' : 'rack'} className="w-4 h-4" style={{ color: LANE_COLOR[band.lane] }} />
            <span className="text-[9.5px] text-slate-200 font-medium leading-tight">{band.label}</span>
            <span className="text-[8.5px] font-mono text-slate-400">{storageCounts[key] || 0}건 보관중</span>
          </IsoBuilding>
        ))}

        {/* sort hub */}
        <IsoBuilding col={SORT_COL} row={SORT_ROW} width={104} elevation={54} borderColor={bottleneck ? '#ef4444' : 'rgba(192,132,252,.5)'} glow="#ef4444" active={!!bottleneck}>
          <EquipIcon name="sorter" className="w-5 h-5 text-purple-300" />
          <span className="text-[10px] text-slate-100 font-semibold leading-tight">Libiao 3D 소터</span>
          {bottleneck && <span className="text-[8.5px] font-mono text-red-400 blink-fast">BOTTLENECK</span>}
        </IsoBuilding>

        {/* picking lane markers */}
        {Object.entries(PICKING_LANES).map(([key, lane]) => (
          <IsoBuilding
            key={key}
            col={PICKING_COL_RANGE[0] + 1}
            row={(lane.rowRange[0] + lane.rowRange[1]) / 2}
            width={118}
            elevation={42}
            borderColor="rgba(52,211,153,.4)"
          >
            <EquipIcon name={key === 'climber' ? 'climber' : 'amr'} className="w-4 h-4 text-emerald-300" />
            <span className="text-[9.5px] text-slate-200 font-medium leading-tight">{lane.label}</span>
          </IsoBuilding>
        ))}

        {/* outbound dock buildings */}
        {OUTBOUND_DOCKS.map((d) => {
          const isFailed = failure && failure.dockId === d.id;
          return (
            <IsoBuilding key={d.id} col={OUTBOUND_COL} row={d.row} width={86} elevation={44} borderColor={isFailed ? '#ef4444' : 'rgba(245,158,11,.45)'} glow="#ef4444" active={isFailed}>
              {isFailed ? (
                <>
                  <EquipIcon name="error" className="w-4 h-4 text-slate-500 blink-fast" />
                  <span className="text-[9px] font-mono text-red-400 blink-fast">ERROR</span>
                </>
              ) : (
                <>
                  <EquipIcon name="auto-out" className="w-4 h-4 text-amber-300" />
                  <span className="text-[9.5px] text-slate-200 font-medium leading-tight">{d.method}</span>
                </>
              )}
            </IsoBuilding>
          );
        })}

        {/* WCS AI core + ping */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: DESIGN_W, height: DESIGN_H, zIndex: 9000 }}>
          <AnimatePresence>
            {pulse && (
              <motion.line
                key={pulse.key}
                x1={wcsCore.x}
                y1={wcsCore.y}
                x2={isoPoint(pulse.col, pulse.row).x}
                y2={isoPoint(pulse.col, pulse.row).y}
                stroke="#60a5fa"
                strokeWidth="1.5"
                strokeDasharray="4 5"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.85, 0] }}
                transition={{ duration: 0.6 }}
              />
            )}
          </AnimatePresence>
        </svg>
        <div className="absolute rounded-full pulse-ring border border-accent-soft/50" style={{ left: wcsCore.x - 26, top: wcsCore.y - 26, width: 52, height: 52, zIndex: 9001 }} />
        <div
          className="absolute rounded-full bg-gradient-to-br from-accent to-blue-700 flex items-center justify-center shadow-glow"
          style={{ left: wcsCore.x - 18, top: wcsCore.y - 18, width: 36, height: 36, zIndex: 9002 }}
        >
          <EquipIcon name="brain" className="w-4 h-4 text-white" />
        </div>
        <div
          className="absolute whitespace-nowrap text-[10px] font-mono font-semibold text-slate-400 tracking-widest pointer-events-none"
          style={{ left: wcsCore.x, top: wcsCore.y - 38, transform: 'translateX(-50%)', zIndex: 9002 }}
        >
          WCS AI CORE
        </div>

        {/* ambient storage rebalancing flicker */}
        <AnimatePresence>
          {ambient && (
            <motion.div
              key={ambient.key}
              className="absolute rounded-full border border-blue-300/70"
              style={{
                left: isoPoint(ambient.col, ambient.row).x - 10,
                top: isoPoint(ambient.col, ambient.row).y - 4,
                width: 20,
                height: 20,
                zIndex: 6000,
              }}
              initial={{ opacity: 0.8, scale: 0.4 }}
              animate={{ opacity: 0, scale: 1.8 }}
              transition={{ duration: 1 }}
            />
          )}
        </AnimatePresence>

        {/* inbound items in transit */}
        {inboundItems.map((o) => {
          const { col, row } = currentPos(o, INBOUND_DURATIONS);
          const isHold = o.phase === 'decide1' || o.phase === 'decide2';
          return <IsoToken key={o.id} col={col} row={row} color={LANE_COLOR[o.lane]} glow={isHold} elevation={16} />;
        })}

        {/* batch tokens */}
        {batches.flatMap((batch) =>
          batch.tokens.map((tk) => {
            const { col, row } = currentPos(tk, BATCH_DURATIONS);
            return <IsoToken key={tk.id} col={col} row={row} color={LANE_COLOR[tk.lane]} glow={tk.rerouted} elevation={18} />;
          })
        )}

        {/* urgent tokens */}
        {urgentTokens.map((tk) => {
          const { col, row } = currentPos(tk, URGENT_DURATIONS);
          return <IsoToken key={tk.id} col={col} row={row} color="#f59e0b" glow size={16} elevation={26} />;
        })}
      </div>
    </div>
  );
}
