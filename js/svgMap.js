// Builds the static warehouse floor-plan (docks, zones, racks, guide paths)
// and exposes slot-allocation helpers + dynamic layer groups for the engine.

const WarehouseMap = (() => {
  let svg;
  const layers = {};
  const shuttleCells = []; // {row,col,x,y,el,filled}
  const climberCells = []; // {level,col,x,y,el,filled}
  const dockState = new Map(); // dockId -> {busy, el, lightEl}

  function init(svgRoot) {
    svg = svgRoot;
    svg.setAttribute('viewBox', `0 0 ${LAYOUT.viewBox.w} ${LAYOUT.viewBox.h}`);

    drawDefs();
    drawFloor();
    drawGuidePaths();
    drawDockGroup(LAYOUT.inboundAutoDocks, '자동입고장치존', 'inbound-auto');
    drawDockGroup(LAYOUT.inboundGeneralDocks, '일반 하차장', 'inbound-general');
    drawRobotArm();
    drawHub(LAYOUT.inboundHub, '입고 분류 AI', 'hub-inbound');
    drawShuttleZone();
    drawClimberZone();
    drawHub(LAYOUT.orderHub, '오더 분석 AI', 'hub-order');
    drawPickLane(LAYOUT.pickLanes.haipick, 'HAIPICK 피킹\n(스마트글라스 불필요)', 'climber');
    drawPickLane(LAYOUT.pickLanes.cart, '피킹카트\n(스마트글라스)', 'cart');
    drawPickLane(LAYOUT.pickLanes.amr, 'AMR 피킹\n(스마트글라스)', 'amr');
    drawSorterZone();
    drawPackStation();
    drawDockGroup(LAYOUT.outboundDocks, '출고 도크', 'outbound');

    // Dynamic layers, back to front
    layers.fx = addLayer('layer-fx');
    layers.pallets = addLayer('layer-pallets');
    layers.trucks = addLayer('layer-trucks');
    layers.agents = addLayer('layer-agents');
    layers.labels = addLayer('layer-labels');

    return { layers };
  }

  function addLayer(cls) {
    const g = svgEl('g', { class: cls });
    svg.appendChild(g);
    return g;
  }

  function drawDefs() {
    const defs = svgEl('defs');
    const glow = svgEl('filter', { id: 'glow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
    glow.appendChild(svgEl('feGaussianBlur', { stdDeviation: '4', result: 'blur' }));
    const merge = svgEl('feMerge');
    merge.appendChild(svgEl('feMergeNode', { in: 'blur' }));
    merge.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
    glow.appendChild(merge);
    defs.appendChild(glow);

    const arrow = svgEl('marker', {
      id: 'arrow', viewBox: '0 0 10 10', refX: '8', refY: '5',
      markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse',
    });
    arrow.appendChild(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--guide)' }));
    defs.appendChild(arrow);
    svg.appendChild(defs);
  }

  function drawFloor() {
    svg.appendChild(svgEl('rect', {
      x: 0, y: 0, width: LAYOUT.viewBox.w, height: LAYOUT.viewBox.h, class: 'floor',
    }));
    for (let x = 0; x <= LAYOUT.viewBox.w; x += 40) {
      svg.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: LAYOUT.viewBox.h, class: 'grid-line' }));
    }
    for (let y = 0; y <= LAYOUT.viewBox.h; y += 40) {
      svg.appendChild(svgEl('line', { x1: 0, y1: y, x2: LAYOUT.viewBox.w, y2: y, class: 'grid-line' }));
    }
  }

  function guide(points, dashed = true) {
    const path = svgEl('path', {
      d: pathToD(points),
      class: dashed ? 'guide-path' : 'guide-path solid',
      'marker-end': 'url(#arrow)',
    });
    svg.appendChild(path);
  }

  function drawGuidePaths() {
    const h = LAYOUT.inboundHub;
    LAYOUT.inboundAutoDocks.forEach(d => guide([{ x: d.x + 40, y: d.y }, { x: LAYOUT.robotArm.x, y: LAYOUT.robotArm.y }]));
    guide([LAYOUT.robotArm, h]);
    LAYOUT.inboundGeneralDocks.forEach(d => guide([{ x: d.x + 40, y: d.y }, { x: h.x - 60, y: h.y + 40 }, h]));
    guide([h, { x: LAYOUT.shuttleZone.x, y: LAYOUT.shuttleZone.y + LAYOUT.shuttleZone.h / 2 }]);
    guide([h, { x: h.x + 260, y: h.y - 200 }, { x: LAYOUT.climberZone.x, y: LAYOUT.climberZone.y + LAYOUT.climberZone.h / 2 }]);

    const oh = LAYOUT.orderHub;
    guide([{ x: LAYOUT.climberZone.x + 40, y: LAYOUT.climberZone.y + LAYOUT.climberZone.h }, LAYOUT.pickLanes.haipick]);
    guide([{ x: LAYOUT.shuttleZone.x + 120, y: LAYOUT.shuttleZone.y + LAYOUT.shuttleZone.h }, LAYOUT.pickLanes.cart]);
    guide([{ x: LAYOUT.shuttleZone.x + 220, y: LAYOUT.shuttleZone.y + LAYOUT.shuttleZone.h }, LAYOUT.pickLanes.amr]);
    guide([oh, LAYOUT.pickLanes.haipick]);
    guide([oh, LAYOUT.pickLanes.cart]);
    guide([oh, LAYOUT.pickLanes.amr]);

    const sz = LAYOUT.sorterZone;
    const sorterIn = { x: sz.x, y: sz.y + sz.h / 2 };
    const sorterOut = { x: sz.x + sz.w, y: sz.y + sz.h / 2 };
    guide([LAYOUT.pickLanes.haipick, { x: sz.x + sz.w * 0.3, y: sz.y }]);
    guide([LAYOUT.pickLanes.cart, sorterIn]);
    guide([LAYOUT.pickLanes.amr, sorterIn]);
    guide([sorterOut, LAYOUT.packStation]);
    guide([LAYOUT.pickLanes.haipick, LAYOUT.packStation]);
    LAYOUT.outboundDocks.forEach(d => guide([LAYOUT.packStation, { x: d.x - 40, y: d.y }]));
  }

  function drawDockGroup(docks, label, group) {
    const g = svgEl('g', { class: `dock-group ${group}` });
    const isOutbound = group === 'outbound';
    const minY = Math.min(...docks.map(d => d.y)) - 34;
    const maxY = Math.max(...docks.map(d => d.y)) + 34;
    g.appendChild(svgEl('text', {
      x: docks[0].x + (isOutbound ? 40 : -6), y: minY - 8, class: 'zone-title', 'text-anchor': isOutbound ? 'end' : 'start',
    })).textContent = label;
    g.appendChild(svgEl('rect', {
      x: docks[0].x - (isOutbound ? 40 : 6), y: minY, width: 76, height: maxY - minY,
      class: 'dock-bay',
    }));
    docks.forEach(d => {
      const dg = svgEl('g', { class: 'dock', 'data-dock-id': d.id });
      dg.appendChild(svgEl('rect', { x: d.x - 6, y: d.y - 22, width: 52, height: 44, class: 'dock-slot' }));
      const light = svgEl('circle', { cx: d.x + 40, cy: d.y - 16, r: 4, class: 'dock-light idle' });
      dg.appendChild(light);
      dg.appendChild(svgEl('text', { x: d.x + 20, y: d.y + 5, class: 'dock-label', 'text-anchor': 'middle' })).textContent = d.id;
      g.appendChild(dg);
      dockState.set(d.id, { busy: false, el: dg, lightEl: light, x: d.x, y: d.y, group });
    });
    svg.appendChild(g);
  }

  function drawRobotArm() {
    const p = LAYOUT.robotArm;
    const g = svgEl('g', { class: 'robot-arm equip-hoverable', 'data-equip-id': 'robot-arm', transform: `translate(${p.x} ${p.y})` });
    g.appendChild(svgEl('circle', { r: 20, class: 'arm-base' }));
    const arm = svgEl('g', { class: 'arm-limb' });
    arm.appendChild(svgEl('rect', { x: -3, y: -34, width: 6, height: 34, rx: 3 }));
    arm.appendChild(svgEl('circle', { cy: -34, r: 6 }));
    g.appendChild(arm);
    g.appendChild(svgEl('text', { y: 36, class: 'zone-title small', 'text-anchor': 'middle' })).textContent = '로봇팔 자동하차';
    svg.appendChild(g);
  }

  function drawHub(p, label, id) {
    const g = svgEl('g', { class: 'hub', id });
    g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 26, class: 'hub-ring' }));
    g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 26, class: 'hub-ring pulse' }));
    g.appendChild(svgEl('text', { x: p.x, y: p.y - 2, class: 'hub-label', 'text-anchor': 'middle' })).textContent = 'AI';
    g.appendChild(svgEl('text', { x: p.x, y: p.y + 44, class: 'zone-title small', 'text-anchor': 'middle' })).textContent = label;
    svg.appendChild(g);
  }

  function drawShuttleZone() {
    const z = LAYOUT.shuttleZone;
    const g = svgEl('g', { class: 'zone shuttle-zone equip-hoverable', 'data-equip-id': 'shuttle' });
    g.appendChild(svgEl('rect', { x: z.x, y: z.y, width: z.w, height: z.h, class: 'zone-bg' }));
    g.appendChild(svgEl('text', { x: z.x + z.w / 2, y: z.y - 10, class: 'zone-title', 'text-anchor': 'middle' })).textContent = z.label;
    const gx = z.x + (z.w - z.cols * z.cellW) / 2;
    const gy = z.y + 30;
    for (let r = 0; r < z.rows; r++) {
      for (let c = 0; c < z.cols; c++) {
        const x = gx + c * z.cellW;
        const y = gy + r * z.cellH;
        const rect = svgEl('rect', {
          x: x + 3, y: y + 5, width: z.cellW - 6, height: z.cellH - 10, rx: 2, class: 'rack-cell',
        });
        g.appendChild(rect);
        shuttleCells.push({ row: r, col: c, x: x + z.cellW / 2, y: y + z.cellH / 2, el: rect, filled: false });
      }
    }
    const shuttle = svgEl('rect', { x: gx, y: gy, width: 14, height: 10, rx: 2, class: 'shuttle-bot' });
    g.appendChild(shuttle);
    svg.appendChild(g);
    layers.shuttleBot = shuttle;
  }

  function drawClimberZone() {
    const z = LAYOUT.climberZone;
    const g = svgEl('g', { class: 'zone climber-zone equip-hoverable', 'data-equip-id': 'climber' });
    g.appendChild(svgEl('rect', { x: z.x, y: z.y, width: z.w, height: z.h, class: 'zone-bg' }));
    g.appendChild(svgEl('text', { x: z.x + z.w / 2, y: z.y - 10, class: 'zone-title', 'text-anchor': 'middle' })).textContent = z.label;
    const gx = z.x + (z.w - z.cols * z.cellW) / 2;
    const gy = z.y + 30;
    for (let lvl = 0; lvl < z.levels; lvl++) {
      for (let c = 0; c < z.cols; c++) {
        const x = gx + c * z.cellW;
        const y = gy + lvl * z.cellH;
        const rect = svgEl('rect', {
          x: x + 3, y: y + 3, width: z.cellW - 6, height: z.cellH - 6, rx: 2, class: 'tote-cell',
        });
        g.appendChild(rect);
        climberCells.push({ level: lvl, col: c, x: x + z.cellW / 2, y: y + z.cellH / 2, el: rect, filled: false });
      }
    }
    g.appendChild(svgEl('rect', { x: gx - 10, y: gy, width: 4, height: z.levels * z.cellH, class: 'climber-rail' }));
    const climber = svgEl('rect', { x: gx - 16, y: gy, width: 16, height: 8, rx: 2, class: 'climber-bot' });
    g.appendChild(climber);
    svg.appendChild(g);
    layers.climberBot = climber;
  }

  function drawPickLane(p, label, equipId) {
    const g = svgEl('g', { class: 'zone pick-lane equip-hoverable', 'data-equip-id': equipId });
    g.appendChild(svgEl('rect', { x: p.x - 70, y: p.y - 30, width: 140, height: 60, rx: 10, class: 'zone-bg small' }));
    const lines = label.split('\n');
    lines.forEach((line, i) => {
      g.appendChild(svgEl('text', {
        x: p.x, y: p.y - 4 + i * 14, class: 'zone-title small', 'text-anchor': 'middle',
      })).textContent = line;
    });
    svg.appendChild(g);
  }

  function drawSorterZone() {
    const z = LAYOUT.sorterZone;
    const g = svgEl('g', { class: 'zone sorter-zone equip-hoverable', 'data-equip-id': 'sorter' });
    g.appendChild(svgEl('rect', { x: z.x, y: z.y, width: z.w, height: z.h, class: 'zone-bg' }));
    g.appendChild(svgEl('text', { x: z.x + z.w / 2, y: z.y - 10, class: 'zone-title small', 'text-anchor': 'middle' })).textContent = z.label;
    const gx = z.x + (z.w - z.cols * z.cellW) / 2;
    const gy = z.y + 20;
    const chutes = [];
    for (let r = 0; r < z.rows; r++) {
      for (let c = 0; c < z.cols; c++) {
        const x = gx + c * z.cellW;
        const y = gy + r * z.cellH;
        const rect = svgEl('rect', {
          x: x + 2, y: y + 2, width: z.cellW - 4, height: z.cellH - 4, rx: 2, class: 'chute-cell',
        });
        g.appendChild(rect);
        chutes.push(rect);
      }
    }
    svg.appendChild(g);
    layers.sorterChutes = chutes;
  }

  function drawPackStation() {
    const p = LAYOUT.packStation;
    const g = svgEl('g', { class: 'zone pack-station equip-hoverable', 'data-equip-id': 'pack-station' });
    g.appendChild(svgEl('rect', { x: p.x - 70, y: p.y - 34, width: 140, height: 68, rx: 10, class: 'zone-bg small' }));
    g.appendChild(svgEl('text', { x: p.x, y: p.y - 6, class: 'zone-title small', 'text-anchor': 'middle' })).textContent = '패킹 / 오토검수';
    g.appendChild(svgEl('text', { x: p.x, y: p.y + 12, class: 'zone-title small dim', 'text-anchor': 'middle' })).textContent = '출고도크 자동배정';
    svg.appendChild(g);
  }

  // ---- Slot allocation helpers ----
  function occupyRandomEmptyCell(cells) {
    const empty = cells.filter(c => !c.filled);
    if (!empty.length) return null;
    const cell = randomFrom(empty);
    cell.filled = true;
    cell.el.classList.add('filled');
    return cell;
  }

  function freeRandomFilledCell(cells) {
    const filled = cells.filter(c => c.filled);
    if (!filled.length) return null;
    const cell = randomFrom(filled);
    cell.filled = false;
    cell.el.classList.remove('filled');
    return cell;
  }

  function occupyShuttleCell() { return occupyRandomEmptyCell(shuttleCells); }
  function freeShuttleCell() { return freeRandomFilledCell(shuttleCells); }
  function occupyClimberCell() { return occupyRandomEmptyCell(climberCells); }
  function freeClimberCell() { return freeRandomFilledCell(climberCells); }

  function fillRatio(cells) { return cells.filter(c => c.filled).length / cells.length; }

  function pickDock(group) {
    const candidates = [...dockState.entries()].filter(([, s]) => s.group === group && !s.busy);
    if (!candidates.length) return null;
    const [id, state] = randomFrom(candidates);
    state.busy = true;
    state.lightEl.setAttribute('class', 'dock-light busy');
    return { id, ...state };
  }

  function releaseDock(id) {
    const s = dockState.get(id);
    if (!s) return;
    s.busy = false;
    s.lightEl.setAttribute('class', 'dock-light idle');
  }

  // Flash a random sorter chute briefly to visualize an order->chute assignment.
  function flashSorterChute() {
    const chutes = layers.sorterChutes;
    if (!chutes || !chutes.length) return null;
    const idx = randomInt(0, chutes.length - 1);
    const el = chutes[idx];
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 900);
    return idx + 1;
  }

  return {
    init,
    get layers() { return layers; },
    occupyShuttleCell, freeShuttleCell,
    occupyClimberCell, freeClimberCell,
    shuttleFillRatio: () => fillRatio(shuttleCells),
    climberFillRatio: () => fillRatio(climberCells),
    pickDock, releaseDock,
    flashSorterChute,
  };
})();
