// Chrome around the map: event log, KPI tiles, tooltip/inspector, controls.

const UI = (() => {
  let logEl, kpiInboundEl, kpiOutboundEl, kpiUtilEl, kpiAccuracyEl;
  let sparkInboundEl, sparkOutboundEl;
  const inboundTimestamps = [];
  const outboundTimestamps = [];
  const inboundHistory = [];
  const outboundHistory = [];
  let utilization = 88;
  let accuracy = 99.4;

  function init() {
    logEl = document.getElementById('event-log');
    kpiInboundEl = document.getElementById('kpi-inbound');
    kpiOutboundEl = document.getElementById('kpi-outbound');
    kpiUtilEl = document.getElementById('kpi-util');
    kpiAccuracyEl = document.getElementById('kpi-accuracy');
    sparkInboundEl = document.getElementById('spark-inbound');
    sparkOutboundEl = document.getElementById('spark-outbound');

    initTooltip();
    initEquipmentHover();
    initControls();
    initNav();
    renderEquipmentPage();
    tickKpis();
    setInterval(tickKpis, 1000);
  }

  // ---- event log ----
  const TYPE_ICON_CLASS = {
    asn: 'log-asn', decision: 'log-decision', order: 'log-order',
    info: 'log-info', success: 'log-success', warn: 'log-warn',
  };
  function pushLog(message, type = 'info') {
    if (!logEl) return;
    const row = document.createElement('div');
    row.className = `log-row ${TYPE_ICON_CLASS[type] || ''}`;
    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = nowStamp();
    const msg = document.createElement('span');
    msg.className = 'log-msg';
    msg.textContent = message;
    row.appendChild(time);
    row.appendChild(msg);
    logEl.prepend(row);
    while (logEl.children.length > 80) logEl.removeChild(logEl.lastChild);
  }

  // ---- KPI ----
  function bumpStat(kind) {
    const arr = kind === 'inbound' ? inboundTimestamps : outboundTimestamps;
    arr.push(Date.now());
  }

  function ratePerHour(arr) {
    const cutoff = Date.now() - 60_000;
    while (arr.length && arr[0] < cutoff) arr.shift();
    return Math.round(arr.length * 60); // events in last 60s * 60 -> per hour
  }

  function drawSpark(el, history) {
    if (!el) return;
    const w = 84, h = 24;
    const max = Math.max(1, ...history);
    const pts = history.map((v, i) => {
      const x = (i / Math.max(1, history.length - 1)) * w;
      const y = h - (v / max) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    el.setAttribute('points', pts);
  }

  function tickKpis() {
    const inRate = ratePerHour(inboundTimestamps);
    const outRate = ratePerHour(outboundTimestamps);
    inboundHistory.push(inRate);
    outboundHistory.push(outRate);
    if (inboundHistory.length > 24) inboundHistory.shift();
    if (outboundHistory.length > 24) outboundHistory.shift();

    utilization = clamp(utilization + (Math.random() - 0.5) * 4, 78, 97);
    accuracy = clamp(accuracy + (Math.random() - 0.5) * 0.3, 97.8, 99.97);

    if (kpiInboundEl) kpiInboundEl.textContent = `${inRate}`;
    if (kpiOutboundEl) kpiOutboundEl.textContent = `${outRate}`;
    if (kpiUtilEl) kpiUtilEl.textContent = `${utilization.toFixed(0)}%`;
    if (kpiAccuracyEl) kpiAccuracyEl.textContent = `${accuracy.toFixed(1)}%`;
    drawSpark(sparkInboundEl, inboundHistory);
    drawSpark(sparkOutboundEl, outboundHistory);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---- tooltip / inspector (tap or click any moving entity) ----
  function initTooltip() {
    const svg = document.getElementById('wcs-map');
    const tip = document.getElementById('tooltip');
    if (!svg || !tip) return;

    svg.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.entity');
      if (!el) { tip.classList.remove('show'); return; }
      const info = EntityInfo.get(el);
      if (!info) return;
      tip.innerHTML = `<strong>${info.title}</strong>` + info.lines.map(l => `<div>${l}</div>`).join('');
      const wrap = document.getElementById('map-wrap');
      const rect = wrap.getBoundingClientRect();
      let left = e.clientX - rect.left + 14;
      let top = e.clientY - rect.top + 14;
      tip.style.left = `${Math.min(left, rect.width - 220)}px`;
      tip.style.top = `${Math.min(top, rect.height - 100)}px`;
      tip.classList.add('show');
      e.stopPropagation();
    });

    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#tooltip') && !e.target.closest('.entity')) tip.classList.remove('show');
    });
  }

  // ---- equipment hover info (mouse-over on any static zone/machine) ----
  function initEquipmentHover() {
    const svg = document.getElementById('wcs-map');
    const tip = document.getElementById('equip-tooltip');
    if (!svg || !tip) return;
    let lastId = null;

    function render(id) {
      const info = EQUIPMENT[id];
      if (!info) { tip.classList.remove('show'); lastId = null; return; }
      tip.innerHTML = `
        <div class="equip-tip-head">
          <span class="equip-tip-name">${info.name}</span>
          <span class="equip-tip-cat">${info.category}</span>
        </div>
        <p class="equip-tip-desc">${info.desc}</p>
        <ul class="equip-tip-list">${info.specs.map(s => `<li>${s}</li>`).join('')}</ul>
        <div class="equip-tip-rule-label">배정 기준</div>
        <ul class="equip-tip-list rule">${info.criteria.map(c => `<li>${c}</li>`).join('')}</ul>
      `;
    }

    function position(clientX, clientY) {
      const wrap = document.getElementById('map-wrap');
      const rect = wrap.getBoundingClientRect();
      const tipH = tip.offsetHeight || 220;
      const left = Math.min(clientX - rect.left + 16, rect.width - 300);
      const top = Math.min(clientY - rect.top + 16, rect.height - tipH - 8);
      tip.style.left = `${Math.max(8, left)}px`;
      tip.style.top = `${Math.max(8, top)}px`;
    }

    svg.addEventListener('pointermove', (e) => {
      const el = e.target.closest('.equip-hoverable');
      if (!el) { tip.classList.remove('show'); lastId = null; return; }
      const id = el.getAttribute('data-equip-id');
      if (id !== lastId) { render(id); lastId = id; }
      if (EQUIPMENT[id]) { position(e.clientX, e.clientY); tip.classList.add('show'); }
    });
    svg.addEventListener('pointerleave', () => { tip.classList.remove('show'); lastId = null; });
  }

  // ---- left-nav page switching ----
  function initNav() {
    const buttons = document.querySelectorAll('.nav-item');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        buttons.forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.page').forEach(p => {
          p.classList.toggle('active', p.id === `page-${page}`);
        });
      });
    });
  }

  // ---- 설비 기준 reference page ----
  function renderEquipmentPage() {
    const rules = document.getElementById('rules-summary');
    if (rules) {
      rules.innerHTML = `
        <div class="rule-card">
          <h3>입고 도크 배분 기준</h3>
          <ul>${ROUTING_RULES.inboundDock.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>
        <div class="rule-card">
          <h3>보관존 자동분류 기준</h3>
          <ul>${ROUTING_RULES.storage.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>
        <div class="rule-card">
          <h3>출고 피킹수단 배정 기준</h3>
          <ul>${ROUTING_RULES.picking.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>
      `;
    }

    const grid = document.getElementById('equip-grid');
    if (!grid) return;
    grid.innerHTML = Object.values(EQUIPMENT).map(eq => `
      <div class="equip-card">
        <div class="equip-card-head">
          <span class="equip-card-name">${eq.name}</span>
          <span class="equip-card-cat">${eq.category}</span>
        </div>
        <p>${eq.desc}</p>
        <div class="equip-card-sub">주요 스펙</div>
        <ul>${eq.specs.map(s => `<li>${s}</li>`).join('')}</ul>
        <div class="equip-card-sub">배정 기준</div>
        <ul class="rule">${eq.criteria.map(c => `<li>${c}</li>`).join('')}</ul>
      </div>
    `).join('');
  }

  // ---- controls ----
  function initControls() {
    const playBtn = document.getElementById('btn-play');
    const speedBtns = document.querySelectorAll('[data-speed]');
    const manualIn = document.getElementById('btn-manual-inbound');
    const manualOut = document.getElementById('btn-manual-order');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        Clock.toggle();
        playBtn.textContent = Clock.running ? '⏸ 일시정지' : '▶ 재생';
        playBtn.classList.toggle('paused', !Clock.running);
      });
    }
    speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        Clock.setSpeed(Number(btn.dataset.speed));
        speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    manualIn?.addEventListener('click', () => manualInboundTrigger());
    manualOut?.addEventListener('click', () => manualOrderTrigger());
  }

  return { init, bumpStat, get logPush() { return pushLog; } };
})();

// Log wrapper used by engine.js
const Log = { push: (msg, type) => UI.logPush(msg, type) };
