import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import useSimulation from './hooks/useSimulation.js';
import ControlBar from './components/ControlBar.jsx';
import IsoWarehouse from './components/IsoWarehouse.jsx';
import DecisionLedger from './components/DecisionLedger.jsx';
import ThroughputPanel from './components/ThroughputPanel.jsx';
import DecisionStory from './components/DecisionStory.jsx';

export default function App() {
  const sim = useSimulation();
  // The landing page fades to black before navigating here, so this page
  // opens under the same black and lifts it. Across a real page load that
  // reads as one crossfade rather than two separate transitions.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

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

      {/* The board is the whole stage now. Everything that used to sit in a
          rail beside it or a strip beneath it overlays the board instead, so
          the warehouse itself gets the full width and height of the screen. */}
      <main className="relative flex min-h-0 flex-1 px-3 py-3">
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

        <div className="pointer-events-none absolute right-6 top-6 z-40 w-[248px]">
          <DecisionLedger counts={sim.dash.counts} latestEvent={sim.events[sim.events.length - 1]} />
        </div>

        <div className="pointer-events-none absolute bottom-6 left-6 z-40 w-[300px]">
          <ThroughputPanel history={sim.dash.history} />
        </div>

        <DecisionStory story={sim.story} onFinish={sim.finishStory} />
      </main>

      {/* Whole-screen red warning frame while a bottleneck or an equipment
          failure is live - the alarm belongs to the board, not one building. */}
      {(sim.bottleneck || sim.failure) && (
        <div className="alert-frame pointer-events-none fixed inset-0 z-[60]" aria-hidden="true" />
      )}

      <motion.div
        className="pointer-events-none fixed inset-0 z-[200] bg-ink-950"
        initial={{ opacity: 1 }}
        animate={{ opacity: entered ? 0 : 1 }}
        transition={{ duration: 0.85, ease: 'easeOut' }}
        aria-hidden="true"
      />
    </div>
  );
}
