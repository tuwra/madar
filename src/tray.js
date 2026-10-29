'use strict';
/* the small window under the menu bar icon: every section opens right here */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const call = (name, ...args) => trayBridge.call(name, ...args);
const pane = $('#pane');
const st = { tab: 'today', month: null, day: null, q: '', page: null };

const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
};
const row = t => `<div class="item ${t.done ? 'done' : ''}" data-id="${t.id}">
    <button class="chk p${t.priority}" data-toggle="${t.id}" aria-label="إنجاز"></button>
    <div class="t"><b>${esc(t.title)}</b>${t.meta ? `<small class="${t.late ? 'late' : ''}">${esc(t.meta)}</small>` : ''}</div>
  </div>`;
const evRow = e => `<div class="ev" style="--c:${e.color}"><i></i><span class="time">${esc(e.time)}</span><span class="grow">${esc(e.title)}</span></div>`;

/* ---------- tabs ---------- */
function setTab(tab) {
  st.tab = tab;
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const on = $(`[data-tab="${tab}"]`), pill = $('.pill');
  pill.style.width = on.offsetWidth + 'px'; pill.style.left = on.offsetLeft + 'px';
  show();
}
async function show(anim = true) {
  const html = await ({ today: viewToday, cal: viewCal, notes: viewNotes, ink: viewInk }[st.tab])();
  pane.innerHTML = html;
  if (anim) { pane.classList.remove('enter'); void pane.offsetWidth; pane.classList.add('enter'); }
  $('input[data-focus]', pane)?.focus();
}

/* ---------- today ---------- */
async function viewToday() {
  const s = await trayBridge.summary();
  $('#day').textContent = s.dateLabel; $('#hijri').textContent = s.hijri;
  const open = s.tasks.filter(t => !t.done), done = s.tasks.filter(t => t.done);
  const total = s.tasks.length, pct = total ? Math.round(done.length / total * 100) : 0;
  return `
    <div class="progress"><div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
      <div><b>${open.length ? `باقي ${open.length} من ${total}` : total ? 'خلّصت كل مهام اليوم 🎉' : 'يومك فاضي'}</b><small>${done.length ? `أنجزت ${done.length} اليوم` : 'ابدأ بأول مهمة'}</small></div></div>
    <form data-form="task"><input data-focus name="q" placeholder="أضف مهمة… (بكرة 5:30 !!)" autocomplete="off"></form>
    <div class="list">
      ${total ? open.map(row).join('') + done.map(row).join('') : '<div class="empty"><b>☀︎</b>ما عندك مهام اليوم</div>'}
      ${s.events.length ? `<div class="sec">المواعيد</div>${s.events.map(evRow).join('')}` : ''}
    </div>
    <footer><span></span><button data-app="tasks">كل المهام ${ICON.open}</button></footer>`;
}

/* ---------- calendar ---------- */
async function viewCal() {
  const m = await call('month', st.month || '');
  st.month = m.m;
  st.day ||= m.days.find(d => d.today)?.ds || m.m + '-01';
  const d = await call('day', st.day);
  return `
    <div class="cal-head"><button class="icon-btn" data-month="${m.prev}" title="الشهر السابق">${ICON.prev}</button><b>${esc(m.label)}</b><button class="icon-btn" data-month="${m.next}" title="الشهر التالي">${ICON.next}</button><button class="chip" data-today>اليوم</button></div>
    <div class="mini">${m.dow.map(x => `<span class="dow">${x}</span>`).join('')}${m.days.map(x => `<button class="dd ${x.other ? 'other' : ''} ${x.today ? 'today' : ''} ${x.ds === st.day ? 'sel' : ''}" data-day="${x.ds}"><span>${x.n}</span><i>${x.dots.map(c => `<em style="background:${c}"></em>`).join('')}</i></button>`).join('')}</div>
    <div class="day-head"><b>${esc(d.label)}</b><small>${esc(d.hijri)}</small></div>
    <form data-form="day"><input data-focus name="q" placeholder="موعد «اجتماع 10:00» أو مهمة…" autocomplete="off"></form>
    <div class="list short">
      ${d.events.map(evRow).join('')}${d.tasks.map(row).join('')}
      ${!d.events.length && !d.tasks.length ? '<div class="empty small">ما فيه شي في هذا اليوم</div>' : ''}
    </div>
    <footer><span></span><button data-app="calendar">فتح التقويم ${ICON.open}</button></footer>`;
}

/* ---------- notes ---------- */
async function viewNotes() {
  if (st.page) {
    const p = await call('page', st.page);
    if (p) return `
      <div class="note-head"><button class="icon-btn" data-back title="رجوع">${ICON.back}</button><span class="nicon">${p.icon}</span><b class="grow">${esc(p.title)}</b><button class="icon-btn" data-openpage="${p.id}" title="فتح في مدار">${ICON.open}</button></div>
      <div class="note-body">${p.blocks.map(noteBlock).join('') || '<div class="empty small">صفحة فاضية</div>'}</div>
      <form data-form="append"><input data-focus name="q" placeholder="أضف سطر… (اكتب [] لمهمة)" autocomplete="off"></form>`;
    st.page = null;
  }
  const list = await call('pages', st.q);
  return `
    <form data-form="note" class="note-new"><textarea name="q" rows="2" placeholder="ملاحظة سريعة… أول سطر يصير العنوان"></textarea><button class="send" title="حفظ">${ICON.plus}</button></form>
    <label class="search">${ICON.search}<input data-search placeholder="ابحث في الملاحظات" value="${esc(st.q)}"></label>
    <div class="list">${list.map(p => `<button class="note" data-page="${p.id}"><span class="nicon">${p.icon}</span><span class="grow"><b>${esc(p.title)}</b><small>${esc(p.preview) || '—'}</small></span><time>${esc(p.when)}</time></button>`).join('') || '<div class="empty small">ما فيه نتائج</div>'}</div>`;
}
function noteBlock(b) {
  const t = esc(b.text);
  switch (b.type) {
    case 'h1': return `<h3>${t}</h3>`;
    case 'h2': case 'h3': return `<h4>${t}</h4>`;
    case 'bullet': return `<p class="li">• ${t}</p>`;
    case 'num': return `<p class="li">– ${t}</p>`;
    case 'todo': return `<button class="todo ${b.checked ? 'done' : ''}" data-block="${b.id}"><span class="box"></span><span>${t}</span></button>`;
    case 'quote': case 'callout': return `<p class="q">${t}</p>`;
    case 'code': return `<pre dir="ltr">${t}</pre>`;
    case 'divider': return '<hr>';
    case 'image': case 'video': case 'audio': case 'file': case 'pdf': return `<p class="att">📎 ${t || 'مرفق'}</p>`;
    default: return t ? `<p>${t}</p>` : '';
  }
}

/* ---------- notebooks ---------- */
async function viewInk() {
  const list = await call('notebooks');
  return `<div class="shelf">${list.map(n => `<button class="book" data-nb="${n.id}" style="--c:${n.color}"><span class="cover ${n.land ? 'land' : ''}">${n.cover ? `<img src="${n.cover}" alt="">` : `<span>${esc(n.name)}</span>`}</span><b>${esc(n.name)}</b><small>صفحة ${n.page} من ${n.pages}</small></button>`).join('') || '<div class="empty small">ما فيه دفاتر بعد</div>'}</div>
    <footer><span class="hint">الكتابة تفتح في مدار</span><button data-app="ink">كل الدفاتر ${ICON.open}</button></footer>`;
}

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button, [data-day]'); if (!t) return;
  if (t.dataset.tab) return setTab(t.dataset.tab);
  if (t.dataset.toggle) {
    t.closest('.item').classList.toggle('done'); t.classList.add('pop');
    if (st.tab === 'cal') await call('toggleOn', st.day, t.dataset.toggle); else await trayBridge.toggle(t.dataset.toggle);
    setTimeout(() => show(false), 260); return;
  }
  if (t.dataset.app) return trayBridge.open(t.dataset.app);
  if (t.dataset.month) { st.month = t.dataset.month; st.day = null; return show(false); }
  if ('today' in t.dataset) { st.month = null; st.day = null; return show(false); }
  if (t.dataset.day) { st.day = t.dataset.day; if (t.classList.contains('other')) st.month = st.day.slice(0, 7); return show(false); }
  if (t.dataset.page) { st.page = t.dataset.page; return show(); }
  if ('back' in t.dataset) { st.page = null; return show(); }
  if (t.dataset.openpage) return trayBridge.openItem('openPage', t.dataset.openpage);
  if (t.dataset.block) { t.classList.toggle('done'); await call('toggleBlock', st.page, t.dataset.block); return; }
  if (t.dataset.nb) return trayBridge.openItem('openNotebook', t.dataset.nb);
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, v = f.elements.q.value.trim(); if (!v) return;
  f.elements.q.value = '';
  if (f.dataset.form === 'task') await trayBridge.add(v);
  if (f.dataset.form === 'day') await call('addOn', st.day, v);
  if (f.dataset.form === 'append') await call('appendToPage', st.page, v);
  if (f.dataset.form === 'note') { st.page = await call('newNote', v); return show(); }
  show(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (st.page) { st.page = null; show(); } else trayBridge.hide(); }
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.matches('textarea')) e.target.form.requestSubmit();
  if (e.metaKey && ['1', '2', '3', '4'].includes(e.key)) setTab(['today', 'cal', 'notes', 'ink'][+e.key - 1]);
});
let searchTimer = null;
document.addEventListener('input', e => {
  if (!e.target.matches('[data-search]')) return;
  st.q = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const list = await call('pages', st.q);
    $('.list', pane).innerHTML = list.map(p => `<button class="note" data-page="${p.id}"><span class="nicon">${p.icon}</span><span class="grow"><b>${esc(p.title)}</b><small>${esc(p.preview) || '—'}</small></span><time>${esc(p.when)}</time></button>`).join('') || '<div class="empty small">ما فيه نتائج</div>';
  }, 150);
});
trayBridge.onRefresh(() => show(false));
window.addEventListener('focus', () => { $('input[data-focus]', pane)?.focus(); });
trayBridge.summary().then(s => { $('#day').textContent = s.dateLabel; $('#hijri').textContent = s.hijri; });
setTab('today');
