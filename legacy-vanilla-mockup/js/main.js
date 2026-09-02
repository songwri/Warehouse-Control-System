document.addEventListener('DOMContentLoaded', () => {
  const svg = document.getElementById('wcs-map');
  WarehouseMap.init(svg);
  UI.init();
  Log.push('🟢 WCS 시뮬레이터 기동 · 자동 운영 모드 시작', 'success');
  startEngine();
});
