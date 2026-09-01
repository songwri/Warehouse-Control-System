// Small animation / math helpers shared across the simulator

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Interpolate a point along a polyline path (array of {x,y}) at t in [0,1]
function pointOnPath(points, t) {
  if (points.length === 1) return points[0];
  const segLens = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    segLens.push(len);
    total += len;
  }
  let dist = t * total;
  for (let i = 0; i < segLens.length; i++) {
    if (dist <= segLens[i] || i === segLens.length - 1) {
      const segT = Math.min(dist / segLens[i], 1);
      return {
        x: lerp(points[i].x, points[i + 1].x, segT),
        y: lerp(points[i].y, points[i + 1].y, segT),
      };
    }
    dist -= segLens[i];
  }
  return points[points.length - 1];
}

function pathToD(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

let __idCounter = 1;
function nextId(prefix) {
  return `${prefix}-${__idCounter++}`;
}

function nowStamp() {
  const d = new Date();
  return d.toLocaleTimeString('ko-KR', { hour12: false });
}

// Simple event emitter
class Emitter {
  constructor() { this._h = {}; }
  on(evt, fn) { (this._h[evt] ||= []).push(fn); return this; }
  emit(evt, payload) { (this._h[evt] || []).forEach(fn => fn(payload)); }
}

// Registry mapping a rendered SVG entity element -> plain-object info,
// used by the tooltip/inspector on tap/click.
const EntityInfo = new WeakMap();
function registerEntity(el, info) {
  el.classList.add('entity');
  EntityInfo.set(el, info);
  return el;
}
function updateEntityInfo(el, patch) {
  EntityInfo.set(el, { ...(EntityInfo.get(el) || {}), ...patch });
}
