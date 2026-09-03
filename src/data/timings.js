// Phase durations (sim-ms at 1x), shared between the simulation engine
// (which advances t against these) and the renderer (which interpolates
// position from t/duration) so the two never drift apart.

// Vehicle lifecycle at the inbound dock: drive in, pause for the arrival
// message, pause again for the cargo-type analysis, then unload.
export const VEHICLE_DURATIONS = { arriving: 700, arrived: 650, analyzing: 700, unloading: 550, leaving: 650 };

// One cargo unit (a box, or a pallet) traveling from the dock into its
// storage slot once the vehicle has classified it.
export const CARGO_DURATIONS = { toEdge: 750, toSlot: 700 };

// A picked/grouped order token: picking -> optional sort -> packing -> outbound.
export const GROUP_DURATIONS = {
  toPicking: 1000,
  atPicking: 900,
  toSort: 850,
  atSort: 850,
  // discrete work runs the express row instead of entering a sorter
  toBypass: 900,
  toPacking: 900,
  atPacking: 650,
  toOutbound: 1000,
  atOutbound: 650,
  // rolls off the right edge of the map once loaded
  departing: 900,
};

// A pallet shipment: already unit-of-issue, so it skips picking and sort and
// goes straight from storage to packing to outbound.
export const PALLET_SHIP_DURATIONS = { toPacking: 700, atPacking: 400, toOutbound: 800, atOutbound: 400, departing: 900 };

export const URGENT_DURATIONS = { toPicking: 700, atPicking: 350, toOutbound: 700, atOutbound: 350, departing: 900 };

// ---- Equipment throughput, as a multiplier on how long a token dwells ----
// Below 1 is faster than baseline. This is the difference an executive is
// meant to SEE: automated stations clear their tokens visibly sooner than
// manual ones, so the value of automation reads off the board without a
// number anywhere near it.
export const PICK_SPEED = {
  climber: 0.45, // 박스/pcs 보관자동화 - storage, pick and sort in one place
  dps: 0.6,      // DPS(컨베이어)
  amr: 0.95,     // AMR(로봇)
  dpc: 1.5,      // DPC(카트) - a person pushing a cart
};

export const SORT_SPEED = {
  libiao: 0.7, // AGV(로봇)
  das: 1.15,   // DAS(컨베이어)
};

// The most legible contrast on the board: manual packing takes well over
// twice as long per token as the automated line right next to it.
export const PACK_SPEED = {
  auto: 0.55,
  manual: 2.4,
};

// Cargo settles into the automated bands faster than onto the manual rack.
export const STORE_SPEED = {
  climber: 0.7,
  shuttle: 0.85,
  rack: 1.35,
};

// Which phases each speed factor applies to. Travel legs are left alone: a
// token crosses the floor at the same speed regardless of where it is going,
// and only the time spent AT a station reflects that station's throughput.
export function phaseDuration(durations, phase, speed = 1) {
  const base = durations[phase] || 1;
  const isDwell = phase.startsWith('at');
  return isDwell ? base * speed : base;
}

// Position along a route that follows the grid rather than cutting across it.
//
// Tokens used to interpolate col and row together, which draws a straight
// diagonal over the floor and reads as things flying through racking. A real
// floor has aisles, so a move is now two legs joined by one 90 degree turn:
// advance along the process axis (col) first, then align to the target lane
// (row). Splitting progress by each leg's share of the total distance keeps
// the speed constant through the corner instead of lurching.
export function currentPos(actor, durations) {
  const dur = phaseDuration(durations, actor.phase, actor.speed || 1);
  const p = Math.max(0, Math.min(1, actor.t / dur));

  const from = actor.from;
  const to = actor.to;
  const dc = to.col - from.col;
  const dr = to.row - from.row;
  const legC = Math.abs(dc);
  const legR = Math.abs(dr);
  const total = legC + legR;

  if (total < 0.0001) return { col: to.col, row: to.row };

  const travelled = p * total;

  // Which leg runs first matters at the outbound docks. Column-first means a
  // token bound for the middle dock arrives at the BOTTOM dock's tile and
  // then slides up the dock face, which looks like it called at the manual
  // dock on the way. Row-first lines the token up with its dock while it is
  // still upstream, so the final leg drops straight into the dock from above.
  if (actor.legOrder === 'row') {
    if (travelled <= legR) {
      return { col: from.col, row: from.row + Math.sign(dr) * travelled };
    }
    return { col: from.col + Math.sign(dc) * (travelled - legR), row: to.row };
  }

  if (travelled <= legC) {
    return { col: from.col + Math.sign(dc) * travelled, row: from.row };
  }
  return { col: to.col, row: from.row + Math.sign(dr) * (travelled - legC) };
}
