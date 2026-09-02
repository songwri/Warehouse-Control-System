import useSimulation, { TOTAL_ORDERS } from './hooks/useSimulation.js';
import ControlBar from './components/ControlBar.jsx';
import IsoWarehouse from './components/IsoWarehouse.jsx';
import Dashboard from './components/Dashboard.jsx';
import DecisionLedger from './components/DecisionLedger.jsx';
import WmsPanel from './components/WmsPanel.jsx';
import DecisionStory from './components/DecisionStory.jsx';

export default function App() {
  const sim = useSimulation();

  return (
    <div className="h-screen w-screen flex flex-col bg-ink-950 text-slate-100 font-body">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-blue-700 flex items-center justify-center font-display font-bold text-sm">
            W
          </div>
          <div>
            <h1 className="font-display text-base font-semibold leading-tight">WCS Simulator</h1>
            <p className="text-[10px] font-mono text-slate-500 leading-tight">
              Warehouse Control System · 입고 누적 {sim.dash.totalAbsorbed}건
            </p>
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-500">
          출고완료 {sim.dash.completedCount} / {TOTAL_ORDERS}
          {sim.dash.urgentCompleted > 0 && <span className="text-amber-400 ml-1.5">+ 긴급 {sim.dash.urgentCompleted}건</span>}
        </div>
      </header>

      <ControlBar
        running={sim.running}
        setRunning={sim.setRunning}
        speed={sim.speed}
        setSpeed={sim.setSpeed}
        onBottleneck={sim.triggerBottleneck}
        onUrgent={sim.triggerUrgent}
        onFailure={sim.triggerFailure}
        onReset={sim.reset}
        cooldown={sim.triggerCooldown}
      />

      <main className="relative flex-1 min-h-0 flex flex-col px-4 py-3">
        <IsoWarehouse
          vehicles={sim.vehicles}
          cargoUnits={sim.cargoUnits}
          inboundPile={sim.inboundPile}
          storageCounts={sim.storageCounts}
          groups={sim.groups}
          palletShipments={sim.palletShipments}
          urgentTokens={sim.urgentTokens}
          pulse={sim.pulse}
          bottleneck={sim.bottleneck}
          failure={sim.failure}
          callouts={sim.callouts}
          coreCaption={sim.coreCaption}
        />
        <WmsPanel pendingCount={sim.wmsPendingCount} ordersSpawned={sim.wmsOrdersSpawned} groupsFormed={sim.wmsGroupsFormed} />
        <DecisionLedger counts={sim.dash.counts} latestEvent={sim.events[sim.events.length - 1]} />
        {/* corner variant anchors inside <main>; the modal variant is fixed
            and covers the whole viewport regardless of where it mounts */}
        <DecisionStory story={sim.story} onFinish={sim.finishStory} />
      </main>

      <Dashboard sim={sim} />

      {/* Whole-screen red warning frame while a bottleneck or an equipment
          failure is live - the alarm belongs to the board, not one building. */}
      {(sim.bottleneck || sim.failure) && (
        <div className="alert-frame pointer-events-none fixed inset-0 z-[60]" aria-hidden="true" />
      )}
    </div>
  );
}
