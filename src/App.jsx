import useSimulation from './hooks/useSimulation.js';
import ControlBar from './components/ControlBar.jsx';
import FlowGrid from './components/FlowGrid.jsx';
import Dashboard from './components/Dashboard.jsx';
import Toasts from './components/Toasts.jsx';
import { TOTAL_ORDERS } from './data/equipment.js';

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
              Warehouse Control System · 임원 데모 · {sim.batchesSpawned * 20 > TOTAL_ORDERS ? TOTAL_ORDERS : sim.batchesSpawned * 20}/{TOTAL_ORDERS} 오더
            </p>
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-500">
          완료 {sim.completedCount} / {TOTAL_ORDERS}
          {sim.urgentCompleted > 0 && <span className="text-amber-400 ml-1.5">+ 긴급 {sim.urgentCompleted}건</span>}
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
        <FlowGrid orders={sim.orders} running={sim.running} bottleneck={sim.bottleneck} failure={sim.failure} />
        <Toasts events={sim.events} />
      </main>

      <Dashboard orders={sim.orders} completedCount={sim.completedCount} metrics={sim.metrics} running={sim.running} />
    </div>
  );
}
