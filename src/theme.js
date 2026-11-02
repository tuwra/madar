'use strict';
/* ---------- light or dark, chosen per device; runs before the page draws so it never flashes ---------- */
(function () {
  const NAMES = { auto: 'تلقائي', light: 'فاتح', dark: 'داكن' };
  let mode = 'auto';
  try { mode = localStorage.getItem('madar-theme') || 'auto'; } catch { /* private mode */ }
  function apply() {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = mode;
    const label = document.querySelector('#theme-name');
    if (label) label.textContent = `المظهر: ${NAMES[mode]}`;
  }
  apply();
  document.addEventListener('DOMContentLoaded', apply);
  window.cycleTheme = () => {
    mode = { auto: 'light', light: 'dark', dark: 'auto' }[mode];
    try { localStorage.setItem('madar-theme', mode); } catch { /* private mode */ }
    apply();
  };
})();
