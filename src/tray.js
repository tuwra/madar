'use strict';
/* the small window under the menu bar icon */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function draw(s) {
  if (!s) return;
  $('#day').textContent = s.dateLabel;
  $('#hijri').textContent = s.hijri;
  const open = s.tasks.filter(t => !t.done), done = s.tasks.filter(t => t.done);
  const row = t => `<div class="item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <button class="chk p${t.priority}" data-toggle="${t.id}" aria-label="إنجاز"></button>
      <div class="t"><b>${esc(t.title)}</b>${t.meta ? `<small class="${t.late ? 'late' : ''}">${esc(t.meta)}</small>` : ''}</div>
    </div>`;
  let html = '';
  if (s.tasks.length) html += `<div class="sec">مهام اليوم</div>${open.map(row).join('')}${done.map(row).join('')}`;
  else html += '<div class="empty"><b>✓</b>ما عندك مهام اليوم</div>';
  if (s.events.length) html += `<div class="sec">المواعيد</div>${s.events.map(e => `<div class="ev" data-open="calendar" style="--c:${e.color}"><i></i><span class="time">${esc(e.time)}</span><span>${esc(e.title)}</span></div>`).join('')}`;
  $('#list').innerHTML = html;
  $('#count').textContent = open.length ? `باقي ${open.length} ${open.length === 1 ? 'مهمة' : open.length === 2 ? 'مهمتين' : open.length <= 10 ? 'مهام' : 'مهمة'}` : 'خلّصت مهام اليوم 🎉';
}
async function refresh() { draw(await trayBridge.summary()); }

document.addEventListener('click', async e => {
  const tg = e.target.closest('[data-toggle]');
  if (tg) {
    tg.closest('.item').classList.toggle('done'); // feels instant; the real state follows
    draw(await trayBridge.toggle(tg.dataset.toggle));
    return;
  }
  const op = e.target.closest('[data-open]');
  if (op) trayBridge.open(op.dataset.open);
});
$('#quick').addEventListener('submit', async e => {
  e.preventDefault();
  const v = $('#q').value.trim(); if (!v) return;
  $('#q').value = '';
  draw(await trayBridge.add(v));
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') trayBridge.hide(); });
trayBridge.onRefresh(refresh);
window.addEventListener('focus', () => { refresh(); $('#q').focus(); });
refresh();
