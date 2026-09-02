// Phase durations (sim-ms at 1x), shared between the simulation engine
// (which advances t against these) and the renderer (which interpolates
// position from t/duration) so the two never drift apart.

// Vehicle lifecycle at the inbound dock: drive in, pause for the arrival
// message, pause again for the cargo-type analysis, then unload.
export const VEHICLE_DURATIONS = { arriving: 700, arrived: 650, analyzing: 700, unloading: 550, leaving: 650 };

// One cargo unit (a box, or a pallet) traveling from the dock into its
// storage slot once the vehicle has classified it.
export const CARGO_DURATIONS = { toEdge: 500, toSlot: 450 };

// A picked/grouped order token: picking -> optional sort -> packing -> outbound.
export const GROUP_DURATIONS = {
  toPicking: 750,
  atPicking: 550,
  toSort: 650,
  atSort: 550,
  toPacking: 700,
  atPacking: 400,
  toOutbound: 800,
  atOutbound: 400,
};

// A shuttle pallet shipment: already unit-of-issue, so it skips picking
// and sort and goes straight from storage to packing to outbound.
export const PALLET_SHIP_DURATIONS = { toPacking: 700, atPacking: 400, toOutbound: 800, atOutbound: 400 };

export const URGENT_DURATIONS = { toPicking: 700, atPicking: 350, toOutbound: 700, atOutbound: 350 };

export function currentPos(actor, durations) {
  const dur = durations[actor.phase] || 1;
  const p = Math.max(0, Math.min(1, actor.t / dur));
  return {
    col: actor.from.col + (actor.to.col - actor.from.col) * p,
    row: actor.from.row + (actor.to.row - actor.from.row) * p,
  };
}
