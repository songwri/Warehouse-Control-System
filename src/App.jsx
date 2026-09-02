import useSimulation from './hooks/useSimulation.js';
import ControlBar from './components/ControlBar.jsx';
import IsoWarehouse from './components/IsoWarehouse.jsx';
import Dashboard from './components/Dashboard.jsx';
import DecisionLedger from './components/DecisionLedger.jsx';
import WmsPanel from './components/WmsPanel.jsx';
import DecisionStory from './components/DecisionStory.jsx';

export default function App() {
  const sim = useSimulation();

  return (
    <div className="flex h-screen w-screen flex-col bg-ink-950 font-body text-slate-100">
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
        completed={sim.dash.completedCount}
        urgentCompleted={sim.dash.urgentCompleted}
      />

      {/* board + a single right rail. The WMS gauge and the decision ledger
          used to float at two different widths and two different insets,
          which left a ragged edge down the right of the screen; they are now
          one column, so every panel shares an alignment edge. */}
      <main className="relative flex min-h-0 flex-1 gap-3 px-3 py-3">
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

        <aside className="flex w-[264px] flex-shrink-0 flex-col gap-3">
          <WmsPanel
            pendingCount={sim.wmsPendingCount}
            ordersSpawned={sim.wmsOrdersSpawned}
            groupsFormed={sim.wmsGroupsFormed}
            threshold={sim.dash.wmsNextThreshold}
          />
          <DecisionLedger counts={sim.dash.counts} latestEvent={sim.events[sim.events.length - 1]} />
        </aside>

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
