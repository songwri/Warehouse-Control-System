// Scenario engine: drives the auto-playing inbound/outbound story on the map.
// Everything here is rule-of-thumb "looks like an optimizer" logic, not a
// real allocation algorithm - the point is to *demonstrate* the automation
// story described in the product brief, live and continuously.

const Clock = {
  running: true,
  speed: 1,
  toggle() { this.running = !this.running; },
  setSpeed(s) { this.speed = s; },
};

function wait(ms) {
  return new Promise(resolve => {
    let remaining = ms;
    let last = performance.now();
    function frame(now) {
      const dt = now - last;
      last = now;
      if (Clock.running) remaining -= dt * Clock.speed;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

function moveAlongPath(el, points, durationMs) {
  return new Promise(resolve => {
    let elapsed = 0;
    let last = performance.now();
    function frame(now) {
      const dt = now - last;
      last = now;
      if (Clock.running) elapsed += dt * Clock.speed;
      const t = Math.min(elapsed / durationMs, 1);
      const p = pointOnPath(points, easeInOutQuad(t));
      el.setAttribute('transform', `translate(${p.x} ${p.y})`);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

const Stats = { inbound: 0, outbound: 0, asnCount: 0, orderCount: 0 };

const DOCK_GROUP_LABEL = {
  'inbound-auto': '자동입고장치존',
  'inbound-general': '일반 하차장',
  outbound: '출고 도크',
};

// ---------- entity factories ----------
function makeTruck(kind) {
  const g = svgEl('g', { class: `truck truck-${kind}` });
  g.appendChild(svgEl('rect', { x: -46, y: -14, width: 34, height: 28, rx: 3, class: 'truck-box' }));
  g.appendChild(svgEl('rect', { x: -12, y: -8, width: 16, height: 22, rx: 2, class: 'truck-cab' }));
  g.appendChild(svgEl('circle', { cx: -34, cy: 15, r: 5, class: 'truck-wheel' }));
  g.appendChild(svgEl('circle', { cx: -6, cy: 15, r: 5, class: 'truck-wheel' }));
  return g;
}

function makePallet(unit) {
  const g = svgEl('g', { class: `pallet pallet-${unit === 'PCS' ? 'pcs' : 'plt'}` });
  g.appendChild(svgEl('rect', { x: -9, y: -9, width: 18, height: 18, rx: 3, class: 'pallet-body' }));
  g.appendChild(svgEl('line', { x1: -9, y1: -9, x2: 9, y2: 9, class: 'pallet-hatch' }));
  g.appendChild(svgEl('line', { x1: 9, y1: -9, x2: -9, y2: 9, class: 'pallet-hatch' }));
  return g;
}

function makeAgent(kind) {
  const g = svgEl('g', { class: `agent agent-${kind}` });
  if (kind === 'cart') {
    g.appendChild(svgEl('rect', { x: -12, y: -10, width: 24, height: 14, rx: 2, class: 'cart-basket' }));
    g.appendChild(svgEl('line', { x1: 12, y1: -8, x2: 20, y2: -16, class: 'cart-handle' }));
    g.appendChild(svgEl('circle', { cx: -7, cy: 6, r: 4, class: 'cart-wheel' }));
    g.appendChild(svgEl('circle', { cx: 7, cy: 6, r: 4, class: 'cart-wheel' }));
  } else if (kind === 'amr') {
    g.appendChild(svgEl('circle', { r: 13, class: 'amr-body' }));
    g.appendChild(svgEl('circle', { r: 13, class: 'amr-ring' }));
    g.appendChild(svgEl('circle', { cx: 0, cy: -13, r: 2.6, class: 'amr-eye' }));
  } else {
    g.appendChild(svgEl('rect', { x: -11, y: -11, width: 22, height: 22, rx: 5, class: 'haipick-body' }));
    g.appendChild(svgEl('circle', { r: 4, class: 'haipick-core' }));
  }
  return g;
}

function attachGlasses(agentEl) {
  const badge = svgEl('g', { class: 'glasses-badge', transform: 'translate(11,-14)' });
  badge.appendChild(svgEl('circle', { cx: -4, cy: 0, r: 3.2, class: 'glasses-lens' }));
  badge.appendChild(svgEl('circle', { cx: 4, cy: 0, r: 3.2, class: 'glasses-lens' }));
  badge.appendChild(svgEl('line', { x1: -1, y1: 0, x2: 1, y2: 0, class: 'glasses-bridge' }));
  agentEl.appendChild(badge);
}

function makePackage() {
  const g = svgEl('g', { class: 'package' });
  g.appendChild(svgEl('rect', { x: -8, y: -8, width: 16, height: 16, rx: 2, class: 'package-body' }));
  g.appendChild(svgEl('line', { x1: 0, y1: -8, x2: 0, y2: 8, class: 'package-tape' }));
  return g;
}

function floatLabel(text, x, y, cls = '') {
  const el = svgEl('text', { x, y, class: `float-label ${cls}` });
  el.textContent = text;
  WarehouseMap.layers.labels.appendChild(el);
  requestAnimationFrame(() => el.classList.add('rise'));
  setTimeout(() => el.remove(), 1700);
}

// ---------- inbound scenario ----------
async function spawnInboundTruck() {
  const isMixedCarton = Math.random() < 0.5;
  const group = isMixedCarton ? 'inbound-auto' : 'inbound-general';

  let dock = null;
  for (let i = 0; i < 8 && !dock; i++) {
    dock = WarehouseMap.pickDock(group);
    if (!dock) await wait(600);
  }
  if (!dock) return;

  Stats.asnCount++;
  const asnId = `ASN-${pad(Stats.asnCount, 4)}`;
  const carrier = randomFrom(CARRIERS);
  const itemCount = randomInt(2, 4);
  const items = Array.from({ length: itemCount }, () => randomFrom(SKU_POOL));

  Log.push(`📥 ${asnId} 입고알림 수신 (${carrier}) · ${isMixedCarton ? '혼합카톤 적재' : '팔레트 단위 적재'}`, 'asn');
  Log.push(`🧭 ${asnId} → ${DOCK_GROUP_LABEL[group]} ${dock.id} 도크 자동배분`, 'decision');

  const truck = makeTruck(isMixedCarton ? 'auto' : 'general');
  WarehouseMap.layers.trucks.appendChild(truck);
  registerEntity(truck, { title: asnId, lines: [`운송사: ${carrier}`, `하차유형: ${isMixedCarton ? '자동입고장치존(로봇팔)' : '일반 하차장'}`, `배정도크: ${dock.id}`, `품목수: ${itemCount}`] });

  const side = dock.x < LAYOUT.viewBox.w / 2 ? -1 : 1;
  await moveAlongPath(truck, [{ x: dock.x + side * 340, y: dock.y }, { x: dock.x + 12, y: dock.y }], 1300);
  Log.push(`🚛 ${asnId} 트럭 ${dock.id} 접안 완료 · 하차 시작`, 'info');

  for (const item of items) {
    const pallet = makePallet(item.unit);
    WarehouseMap.layers.pallets.appendChild(pallet);
    registerEntity(pallet, { title: item.sku, lines: [item.name, `단위: ${item.unit}`, `카테고리: ${item.category}`, `출처: ${asnId}`] });

    const dockPt = { x: dock.x, y: dock.y };
    if (isMixedCarton) {
      await moveAlongPath(pallet, [dockPt, LAYOUT.robotArm], 700);
      const arm = pallet;
      WarehouseMap.layers.pallets.querySelectorAll('.robot-arm-active');
      document.querySelector('.robot-arm')?.classList.add('active');
      await wait(260);
      document.querySelector('.robot-arm')?.classList.remove('active');
      await moveAlongPath(pallet, [LAYOUT.robotArm, LAYOUT.inboundHub], 650);
    } else {
      await moveAlongPath(pallet, [dockPt, { x: LAYOUT.inboundHub.x - 90, y: LAYOUT.inboundHub.y + 60 }, LAYOUT.inboundHub], 900);
    }

    const toClimber = item.unit === 'PCS';
    floatLabel(toClimber ? 'PCS → HAIPICK' : 'PLT → SHUTTLE/RACK', LAYOUT.inboundHub.x, LAYOUT.inboundHub.y - 34, toClimber ? 'accent-pcs' : 'accent-plt');
    Log.push(`🧠 ${item.sku} 보관존 판정: ${toClimber ? 'PCS 단위 → HAIPICK Climber' : '팔레트 단위 → 4-Way Shuttle/팔레트랙'}`, 'decision');

    if (toClimber) {
      await moveAlongPath(pallet, [LAYOUT.inboundHub, { x: LAYOUT.climberZone.x - 20, y: LAYOUT.climberZone.y + LAYOUT.climberZone.h / 2 }], 750);
      const cell = WarehouseMap.occupyClimberCell();
      if (cell) {
        await moveAlongPath(WarehouseMap.layers.climberBot, [
          { x: LAYOUT.climberZone.x + LAYOUT.climberZone.w / 2 - 40, y: cell.y },
        ], 1);
        WarehouseMap.layers.climberBot.setAttribute('transform', `translate(${LAYOUT.climberZone.x - 8},${cell.y})`);
        await moveAlongPath(pallet, [{ x: LAYOUT.climberZone.x - 20, y: LAYOUT.climberZone.y + LAYOUT.climberZone.h / 2 }, cell], 500);
      } else {
        Log.push('⚠️ HAIPICK Climber 존 포화 - 임시 버퍼 대기', 'warn');
      }
    } else {
      await moveAlongPath(pallet, [LAYOUT.inboundHub, { x: LAYOUT.shuttleZone.x - 20, y: LAYOUT.shuttleZone.y + LAYOUT.shuttleZone.h / 2 }], 750);
      const cell = WarehouseMap.occupyShuttleCell();
      if (cell) {
        WarehouseMap.layers.shuttleBot.setAttribute('transform', `translate(${cell.x - 7},${cell.y - 5})`);
        await moveAlongPath(pallet, [{ x: LAYOUT.shuttleZone.x - 20, y: LAYOUT.shuttleZone.y + LAYOUT.shuttleZone.h / 2 }, cell], 500);
      } else {
        Log.push('⚠️ 4-Way Shuttle 존 포화 - 임시 버퍼 대기', 'warn');
      }
    }

    pallet.classList.add('stored');
    await wait(120);
    pallet.remove();
    Stats.inbound++;
    UI.bumpStat('inbound');
    await wait(220);
  }

  Log.push(`✅ ${asnId} 입고 완료 · ${dock.id} 도크 반출`, 'success');
  await wait(200);
  await moveAlongPath(truck, [{ x: dock.x + 12, y: dock.y }, { x: dock.x + side * 340, y: dock.y }], 1100);
  truck.remove();
  WarehouseMap.releaseDock(dock.id);
}

// ---------- outbound / order scenario ----------
async function spawnOrder() {
  Stats.orderCount++;
  const orderId = `ORD-${pad(Stats.orderCount, 5)}`;
  const sku = randomFrom(SKU_POOL);
  const qty = randomInt(1, 6);

  Log.push(`🛒 이커머스 오더 ${orderId} 접수 · ${sku.name} x${qty}`, 'order');
  await wait(260);

  const isPcs = sku.unit === 'PCS';
  const method = isPcs ? 'haipick' : (Math.random() < 0.5 ? 'cart' : 'amr');
  const needsGlasses = method !== 'haipick';
  const methodLabel = { haipick: 'HAIPICK Climber 피킹', cart: '피킹카트 피킹', amr: 'AMR 피킹' }[method];

  Log.push(`🧠 ${orderId} 피킹수단 할당: ${methodLabel}${needsGlasses ? ' · 스마트글라스(오토검수) 배정' : ' · 스마트글라스 불필요'}`, 'decision');
  floatLabel(methodLabel, LAYOUT.orderHub.x, LAYOUT.orderHub.y - 34, 'accent-order');

  const lane = LAYOUT.pickLanes[method];

  if (method === 'haipick') {
    const cell = WarehouseMap.freeClimberCell();
    const pickPt = cell || { x: LAYOUT.climberZone.x + LAYOUT.climberZone.w / 2, y: LAYOUT.climberZone.y + LAYOUT.climberZone.h / 2 };
    await moveAlongPath(WarehouseMap.layers.climberBot, [{ x: LAYOUT.climberZone.x - 8, y: pickPt.y }], 700);
    const item = makePallet('PCS');
    WarehouseMap.layers.pallets.appendChild(item);
    registerEntity(item, { title: orderId, lines: [sku.name, `수량: ${qty}`, '피킹수단: HAIPICK Climber', '스마트글라스: 불필요'] });
    item.setAttribute('transform', `translate(${pickPt.x},${pickPt.y})`);
    await wait(250);
    await moveAlongPath(item, [pickPt, lane, LAYOUT.packStation], 1400);
    item.remove();
  } else {
    const agent = makeAgent(method);
    WarehouseMap.layers.agents.appendChild(agent);
    registerEntity(agent, { title: orderId, lines: [sku.name, `수량: ${qty}`, `피킹수단: ${method === 'cart' ? '피킹카트' : 'AMR'}`, '스마트글라스: 배정됨 (오토검수)'] });
    agent.setAttribute('transform', `translate(${lane.x},${lane.y})`);
    if (needsGlasses) { attachGlasses(agent); floatLabel('스마트글라스 배정', lane.x, lane.y - 26, 'accent-glass'); }

    const cell = WarehouseMap.freeShuttleCell();
    const pickPt = cell || { x: LAYOUT.shuttleZone.x + LAYOUT.shuttleZone.w / 2, y: LAYOUT.shuttleZone.y + LAYOUT.shuttleZone.h / 2 };
    await moveAlongPath(agent, [lane, { x: LAYOUT.shuttleZone.x - 12, y: pickPt.y }, pickPt], 1300);
    await wait(260);
    await moveAlongPath(agent, [pickPt, { x: LAYOUT.shuttleZone.x - 12, y: pickPt.y }, lane, LAYOUT.packStation], 1500);
    agent.remove();
  }

  Log.push(`📦 ${orderId} 패킹 완료${needsGlasses ? ' · 스마트글라스 오토검수 통과' : ''}`, 'info');

  let dock = null;
  for (let i = 0; i < 8 && !dock; i++) {
    dock = WarehouseMap.pickDock('outbound');
    if (!dock) await wait(600);
  }
  if (!dock) { Log.push(`⚠️ ${orderId} 출고도크 대기 (전 도크 사용중)`, 'warn'); return; }

  Log.push(`🧭 ${orderId} → 출고도크 ${dock.id} 자동배정`, 'decision');
  const pkg = makePackage();
  WarehouseMap.layers.pallets.appendChild(pkg);
  pkg.setAttribute('transform', `translate(${LAYOUT.packStation.x},${LAYOUT.packStation.y})`);
  await moveAlongPath(pkg, [LAYOUT.packStation, { x: dock.x - 6, y: dock.y }], 900);
  pkg.remove();

  const truck = makeTruck('outbound');
  WarehouseMap.layers.trucks.appendChild(truck);
  registerEntity(truck, { title: orderId, lines: [`출고도크: ${dock.id}`, `${sku.name} x${qty}`, `피킹수단: ${methodLabel}`] });
  await moveAlongPath(truck, [{ x: dock.x + 340, y: dock.y }, { x: dock.x + 12, y: dock.y }], 1100);
  await wait(300);
  Log.push(`🚚 ${orderId} 출고 완료 · ${dock.id} 도크 출발`, 'success');
  Stats.outbound++;
  UI.bumpStat('outbound');
  await moveAlongPath(truck, [{ x: dock.x + 12, y: dock.y }, { x: dock.x + 340, y: dock.y }], 1000);
  truck.remove();
  WarehouseMap.releaseDock(dock.id);
}

// ---------- loops ----------
async function inboundLoop() {
  while (true) {
    spawnInboundTruck().catch(console.error);
    await wait(randomInt(2600, 4400));
  }
}

async function orderLoop() {
  await wait(1200);
  while (true) {
    spawnOrder().catch(console.error);
    await wait(randomInt(1800, 3200));
  }
}

function startEngine() {
  inboundLoop();
  orderLoop();
}

function manualInboundTrigger() { spawnInboundTruck().catch(console.error); }
function manualOrderTrigger() { spawnOrder().catch(console.error); }
