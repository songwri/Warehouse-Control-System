// Lightweight 2:1 isometric ("quarter view") tile-grid projection.
// Pure 2D math - no CSS 3D transforms - so movement, hit areas and
// z-ordering stay simple and predictable.

export const TILE_W = 60;
export const TILE_H = 30;
export const GRID_COLS = 30;
export const GRID_ROWS = 12;

// Pixel offset so the whole projected grid sits at non-negative x.
export const ORIGIN_X = ((GRID_ROWS - 1) * TILE_W) / 2;

export const DESIGN_W = ORIGIN_X + (GRID_COLS - 1) * (TILE_W / 2) + TILE_W;
export const DESIGN_H = (GRID_COLS - 1 + GRID_ROWS - 1) * (TILE_H / 2) + TILE_H + 140;

// col increases "into" the process (inbound -> outbound), row is lane/position.
export function isoPoint(col, row, elevation = 0) {
  const x = ORIGIN_X + (col - row) * (TILE_W / 2);
  const y = (col + row) * (TILE_H / 2) + 90 - elevation;
  return { x, y };
}

// Painter's order for the whole board. Rows are often fractional (a token
// parked partway down a storage band), and every caller feeds this straight
// into a CSS z-index - which only accepts integers, so a fractional result
// is rejected outright and the element silently falls back to `auto`,
// dropping behind anything with a real z-index. Round here so no call site
// can hit that.
export function depthOf(col, row) {
  return Math.round(col + row);
}
