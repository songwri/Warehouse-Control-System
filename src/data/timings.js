// Phase durations (sim-ms at 1x), shared between the simulation engine
// (which advances t against these) and the renderer (which interpolates
// position from t/duration) so the two never drift apart.

export const INBOUND_DURATIONS = { decide1: 350, toEdge: 650, decide2: 350, toSlot: 500 };
export const BATCH_DURATIONS = { toSort: 900, atSort: 700, toPicking: 850, atPicking: 550, toOutbound: 900, atOutbound: 400 };
export const URGENT_DURATIONS = { toPicking: 700, atPicking: 350, toOutbound: 700, atOutbound: 350 };

export function currentPos(actor, durations) {
  const dur = durations[actor.phase] || 1;
  const p = Math.min(1, actor.t / dur);
  return {
    col: actor.from.col + (actor.to.col - actor.from.col) * p,
    row: actor.from.row + (actor.to.row - actor.from.row) * p,
  };
}
