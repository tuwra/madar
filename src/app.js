'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const todayStr = () => ymd(new Date());
const fmt = (s, o) => new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', o).format(parseYmd(s));
const hijri = s => new Intl.DateTimeFormat('ar-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseYmd(s));
const view = $('#view');

const PRI = ['بدون', 'منخفضة', 'متوسطة', 'عالية'];
const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
const INK_COLORS = ['#1f2937', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c'];
const HL_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4'];
const ICONS = ['📄', '📝', '📚', '💡', '🎯', '📌', '🗂️', '✈️', '🏠', '💼', '🎓', '❤️', '🛒', '📊', '🧠', '⭐', '🌙', '🕌', '💰', '🏋️', '🍳', '🎨', '🧳', '✅'];
const DOW = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DOW_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

/* ---------- storage ---------- */
const idb = {
  db: null,
  async open() {
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open('madar', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  req(mode, fn) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction('kv', mode), r = fn(tx.objectStore('kv'));
      tx.oncomplete = () => res(r.result);
      tx.onerror = () => rej(tx.error);
    });
  },
  get(k) { return this.req('readonly', s => s.get(k)); },
  set(k, v) { return this.req('readwrite', s => s.put(v, k)); },
  del(k) { return this.req('readwrite', s => s.delete(k)); },
};
// In the Mac app, data lives as files in a folder the user picks (it can be
// inside Google Drive); in a plain browser it falls back to IndexedDB.
const desktop = window.madar || null;
const store = {
  ready: false,
  async open() { if (!desktop) await idb.open(); this.ready = true; },
  async loadState() {
    if (!desktop) return idb.get('state');
    const json = await desktop.loadState();
    return json ? JSON.parse(json) : null;
  },
  async saveState(st) {
    if (!desktop) return idb.set('state', st);
    store.mtime = await desktop.saveState(JSON.stringify(st));
  },
  async getBlob(key) {
    if (!desktop) return idb.get(key);
    const r = await desktop.getBlob(key);
    return r ? new Blob([r.bytes], { type: r.type }) : null;
  },
  async setBlob(key, blob) {
    if (!desktop) return idb.set(key, blob);
    await desktop.setBlob(key, new Uint8Array(await blob.arrayBuffer()), blob.type || '');
  },
  delBlob(key) { return desktop ? desktop.delBlob(key) : idb.del(key); },
};
async function putBlob(blob, prefix = 'blob') { const key = `${prefix}:${uid()}`; await store.setBlob(key, blob); return key; }
const blobUrls = new Map();
async function blobUrl(key) {
  if (!key) return '';
  if (!blobUrls.has(key)) {
    const b = await store.getBlob(key);
    blobUrls.set(key, b ? URL.createObjectURL(b) : '');
  }
  return blobUrls.get(key);
}

let state;
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
}
function flush() {
  clearTimeout(saveTimer); saveTimer = null;
  if (store.ready) store.saveState(state).catch(err => { console.error('save failed', err); toast('ما قدرت أحفظ التغييرات: ' + err.message); });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('pagehide', flush);

function newTask(title, listId = 'inbox', due = null, priority = 0) {
  return { id: uid(), title, listId, due, time: null, priority, notes: '', done: false, doneAt: null, created: Date.now() };
}
function seed() {
  const t = todayStr();
  const b = (type, text, checked = false) => ({ id: uid(), type, text, checked });
  return {
    v: 1,
    lists: [
      { id: 'inbox', name: 'الوارد', color: '#64748b' },
      { id: uid(), name: 'شخصي', color: '#10b981' },
      { id: uid(), name: 'العمل', color: '#4f46e5' },
    ],
    tasks: [
      newTask('جرّب الإضافة السريعة: اكتب «اتصل بأحمد بكرة 5:30 !!»', 'inbox', t, 2),
      newTask('افتح التقويم وشوف مهامك على أيامها', 'inbox', t, 0),
      newTask('اكتب أول ملاحظة لك', 'inbox', addDays(t, 1), 1),
    ],
    events: [{ id: uid(), title: 'مثال: اجتماع الفريق', date: t, start: '10:00', end: '11:00', color: '#0ea5e9' }],
    pages: [{
      id: uid(), title: 'أهلاً في مدار', icon: '👋', updated: Date.now(),
      blocks: [
        b('p', 'هذي صفحة ملاحظات. اكتب أي شي، وكل سطر تقدر تحوّله لعنوان أو قائمة أو مهمة. حدد أي نص عشان تخليه عريض أو مظلل أو رابط.'),
        b('h2', 'اختصارات الكتابة'),
        b('bullet', 'اكتب # ثم مسافة لعنوان كبير، و ## لعنوان أصغر'),
        b('bullet', 'اكتب - ثم مسافة لقائمة نقطية'),
        b('bullet', 'اكتب [] ثم مسافة لمربع مهمة'),
        b('bullet', 'اكتب > ثم مسافة لقائمة منسدلة، و --- لخط فاصل'),
        b('callout', 'اكتب / في أي مكان وتطلع لك كل الأوامر: كود، جدول، صورة، ملف، PDF، معادلة، صفحة فرعية، وملف من قوقل درايف'),
        b('todo', 'جرّب تشيّك هذا المربع'),
      ],
    }],
    notebooks: [{ id: uid(), name: 'دفتري الأول', color: '#f59e0b', paper: 'lined', pages: [{ id: uid(), strokes: [] }] }],
  };
}

/* ---------- ui state ---------- */
const ui = { view: 'today', taskFilter: 'today', showDone: false, calMonth: null, calDay: todayStr(), pageId: null, pageSearch: '', notebookId: null, inkPage: 0 };
try { Object.assign(ui, JSON.parse(localStorage.getItem('madar-ui') || '{}')); } catch { /* private mode */ }
ui.calDay = todayStr(); ui.calMonth = null;

let cleanup = null;
function render() {
  cleanup?.(); cleanup = null;
  view.classList.remove('full');
  $$('#nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === ui.view));
  ({ today: renderToday, tasks: renderTasks, calendar: renderCalendar, notes: renderNotes, ink: renderInk })[ui.view]();
  try { localStorage.setItem('madar-ui', JSON.stringify({ view: ui.view, taskFilter: ui.taskFilter, pageId: ui.pageId, notebookId: ui.notebookId, inkPage: ui.inkPage })); } catch { /* ignore */ }
}
function go(v, extra = {}) { Object.assign(ui, { view: v }, extra); view.scrollTop = 0; render(); }

/* ---------- tasks logic ---------- */
const WEEKDAY_WORDS = { 'الأحد': 0, 'الاحد': 0, 'الإثنين': 1, 'الاثنين': 1, 'الثلاثاء': 2, 'الأربعاء': 3, 'الاربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'الجمعه': 5, 'السبت': 6 };
function parseQuick(text, defaults = {}) {
  let t = ' ' + text + ' ';
  let due = defaults.due || null, priority = 0, time = null;
  const word = w => new RegExp(`\\s${w}(?=\\s)`);
  const bang = t.match(/!{1,3}/);
  if (bang) { priority = bang[0].length; t = t.replace(bang[0], ' '); }
  const tm = t.match(/\s(\d{1,2}):(\d{2})(?=\s)/);
  if (tm && +tm[1] < 24 && +tm[2] < 60) { time = `${pad(tm[1])}:${tm[2]}`; t = t.replace(tm[0], ' '); }
  if (word('اليوم').test(t)) { due = todayStr(); t = t.replace(word('اليوم'), ' '); }
  else if (/\s(بكرة|بكره|غدا|غداً)(?=\s)/.test(t)) { due = addDays(todayStr(), 1); t = t.replace(/\s(بكرة|بكره|غدا|غداً)(?=\s)/, ' '); }
  else {
    for (const [w, d] of Object.entries(WEEKDAY_WORDS)) {
      if (word(w).test(t)) {
        const diff = ((d - new Date().getDay()) + 7) % 7 || 7;
        due = addDays(todayStr(), diff); t = t.replace(word(w), ' '); break;
      }
    }
  }
  if (time && !due) due = todayStr();
  return { title: t.replace(/\s+/g, ' ').trim() || text.trim(), due, priority, time };
}
const byTask = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.time || '99').localeCompare(b.time || '99') || b.priority - a.priority || a.created - b.created;
function dueLabel(t) {
  const td = todayStr();
  let s = t.due === td ? 'اليوم' : t.due === addDays(td, 1) ? 'غداً' : t.due === addDays(td, -1) ? 'أمس' : fmt(t.due, { day: 'numeric', month: 'short' });
  if (t.time) s += ' ' + t.time;
  return s;
}
const listOf = id => state.lists.find(l => l.id === id) || state.lists[0];

function taskRow(t, { showList = true } = {}) {
  const l = listOf(t.listId);
  const late = t.due && !t.done && t.due < todayStr();
  return `<div class="task ${t.done ? 'done' : ''}" data-task="${t.id}">
    <button class="check p${t.priority}" data-act="toggle" aria-label="إنجاز"></button>
    <div class="task-body" data-act="edit">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">${t.due ? `<span class="chip ${late ? 'late' : ''}">${dueLabel(t)}</span>` : ''}${showList && l.id !== 'inbox' ? `<span class="chip"><span class="dot" style="--c:${l.color}"></span>${esc(l.name)}</span>` : ''}${t.notes ? '<span class="chip">📝</span>' : ''}</div>
    </div>
  </div>`;
}
function quickAdd({ due = '', list = '', placeholder = 'أضف مهمة…' } = {}) {
  return `<form class="quick" data-quick data-due="${due}" data-list="${list}">
    <input name="q" autocomplete="off" placeholder="${placeholder}">
    <div class="hint">جرّب: «اليوم» أو «بكرة» أو اسم يوم، ووقت مثل 5:30، و ! أو !! أو !!! للأولوية</div>
  </form>`;
}
const taskList = (tasks, opt) => tasks.length ? tasks.map(t => taskRow(t, opt)).join('') : '';

/* ---------- view: today ---------- */
function renderToday() {
  const td = todayStr();
  const h = new Date().getHours();
  const late = state.tasks.filter(t => !t.done && t.due && t.due < td).sort(byTask);
  const today = state.tasks.filter(t => t.due === td).sort((a, b) => a.done - b.done || byTask(a, b));
  const evs = state.events.filter(e => e.date === td).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const pages = [...state.pages].sort((a, b) => b.updated - a.updated).slice(0, 3);
  view.innerHTML = `<div class="wrap">
    <div class="page-head"><div>
      <h1>${h < 12 ? 'صباح الخير' : 'مساء الخير'} ☀️</h1>
      <div class="sub">${fmt(td, { weekday: 'long', day: 'numeric', month: 'long' })} · ${hijri(td)}</div>
    </div></div>
    ${quickAdd({ due: td, placeholder: 'وش بتسوي اليوم؟' })}
    ${late.length ? `<h2>متأخرة</h2>${taskList(late)}` : ''}
    <h2>مهام اليوم</h2>
    ${taskList(today) || '<div class="empty">ما عندك مهام اليوم. استمتع بيومك ✨</div>'}
    <h2>مواعيد اليوم <button class="btn small ghost" data-act="add-event" data-day="${td}">+ موعد</button></h2>
    ${evs.length ? evs.map(agendaItem).join('') : '<div class="empty">ما فيه مواعيد اليوم</div>'}
    <h2>آخر الملاحظات</h2>
    <div class="cards">
      ${pages.map(p => `<button class="card" data-act="open-page" data-page="${p.id}"><span class="big">${p.icon}</span><b>${esc(p.title || 'بدون عنوان')}</b><span class="muted">${blockPreview(p)}</span></button>`).join('')}
      <button class="card" data-act="new-page"><span class="big">＋</span><b>صفحة جديدة</b></button>
    </div>
  </div>`;
}
function agendaItem(e) {
  return `<div class="agenda-item" data-act="event" data-ev="${e.id}" style="--c:${e.color}">
    <span class="bar"></span><span class="time">${e.start ? `${e.start}${e.end ? ' – ' + e.end : ''}` : 'طوال اليوم'}</span><span>${esc(e.title)}</span></div>`;
}

/* ---------- view: tasks ---------- */
function renderTasks() {
  const td = todayStr();
  const open = state.tasks.filter(t => !t.done);
  const smart = [
    { f: 'today', name: 'اليوم', icon: '☀️', n: open.filter(t => t.due && t.due <= td).length },
    { f: 'upcoming', name: 'الأيام القادمة', icon: '🗓️', n: open.filter(t => t.due && t.due > td && t.due <= addDays(td, 7)).length },
    { f: 'all', name: 'كل المهام', icon: '📋', n: open.length },
    { f: 'done', name: 'المكتملة', icon: '✅', n: '' },
  ];
  const f = ui.taskFilter;
  const list = state.lists.find(l => l.id === f);
  if (!list && !smart.some(s => s.f === f)) ui.taskFilter = 'today';

  let title, body, addOpts;
  if (f === 'today') {
    title = 'اليوم';
    const late = open.filter(t => t.due && t.due < td).sort(byTask);
    const now = state.tasks.filter(t => t.due === td).sort((a, b) => a.done - b.done || byTask(a, b));
    body = (late.length ? `<h2>متأخرة</h2>${taskList(late)}<h2>اليوم</h2>` : '') + (taskList(now) || '<div class="empty">ما فيه مهام لليوم</div>');
    addOpts = { due: td };
  } else if (f === 'upcoming') {
    title = 'الأيام القادمة';
    body = '';
    for (let i = 1; i <= 7; i++) {
      const d = addDays(td, i);
      const ts = open.filter(t => t.due === d).sort(byTask);
      body += `<h2>${i === 1 ? 'غداً' : fmt(d, { weekday: 'long' })} · ${fmt(d, { day: 'numeric', month: 'short' })}</h2>${taskList(ts) || '<div class="hint" style="padding:4px 12px">—</div>'}`;
    }
    addOpts = { due: addDays(td, 1) };
  } else if (f === 'all') {
    title = 'كل المهام';
    body = taskList(open.sort(byTask)) || '<div class="empty">خلصت كل شي 🎉</div>';
    addOpts = {};
  } else if (f === 'done') {
    title = 'المكتملة';
    const d = state.tasks.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt);
    body = taskList(d) || '<div class="empty">ما فيه مهام مكتملة بعد</div>';
    addOpts = null;
  } else {
    title = `<span class="dot" style="--c:${list.color};width:12px;height:12px"></span> ${esc(list.name)}`;
    const ts = state.tasks.filter(t => t.listId === list.id);
    const o = ts.filter(t => !t.done).sort(byTask), d = ts.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt);
    body = (taskList(o, { showList: false }) || '<div class="empty">القائمة فاضية</div>') +
      (d.length ? `<h2><button class="btn small ghost" data-act="toggle-done">${ui.showDone ? '▾' : '◂'} المكتملة (${d.length})</button></h2>${ui.showDone ? taskList(d, { showList: false }) : ''}` : '');
    addOpts = { list: list.id };
  }

  view.innerHTML = `<div class="split">
    <aside class="side">
      ${smart.map(s => `<button class="side-item ${f === s.f ? 'active' : ''}" data-act="filter" data-f="${s.f}"><span>${s.icon}</span>${s.name}<span class="n">${s.n || ''}</span></button>`).join('')}
      <div class="side-label">القوائم</div>
      ${state.lists.map(l => `<button class="side-item ${f === l.id ? 'active' : ''}" data-act="filter" data-f="${l.id}"><span class="dot" style="--c:${l.color}"></span>${esc(l.name)}<span class="n">${open.filter(t => t.listId === l.id).length || ''}</span></button>`).join('')}
      <button class="side-item" data-act="add-list" style="color:var(--muted)">＋ قائمة جديدة</button>
    </aside>
    <section>
      <div class="page-head"><h1>${title}</h1>${list && list.id !== 'inbox' ? '<button class="btn small" data-act="edit-list">تعديل القائمة</button>' : ''}</div>
      ${addOpts ? quickAdd(addOpts) : ''}
      <div style="margin-top:10px">${body}</div>
    </section>
  </div>`;
}

/* ---------- view: calendar ---------- */
function renderCalendar() {
  const td = todayStr();
  const sel = ui.calDay;
  const m = ui.calMonth || sel.slice(0, 7);
  ui.calMonth = m;
  const first = parseYmd(m + '-01');
  const start = new Date(first); start.setDate(1 - first.getDay());
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = ymd(d);
    const evs = state.events.filter(e => e.date === ds).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const ts = state.tasks.filter(t => t.due === ds).sort(byTask);
    const items = [
      ...evs.map(e => `<div class="ev" style="--c:${e.color}" data-act="event" data-ev="${e.id}">${e.start ? e.start + ' ' : ''}${esc(e.title)}</div>`),
      ...ts.map(t => `<div class="ev t ${t.done ? 'done' : ''}" style="--c:${listOf(t.listId).color}" data-act="edit" data-task="${t.id}">${esc(t.title)}</div>`),
    ];
    cells += `<div class="day ${ds.slice(0, 7) !== m ? 'other' : ''} ${ds === td ? 'today' : ''} ${ds === sel ? 'sel' : ''}" data-act="day" data-day="${ds}">
      <span class="day-n">${d.getDate()}</span>${items.slice(0, 3).join('')}${items.length > 3 ? `<span class="more">+${items.length - 3}</span>` : ''}</div>`;
  }
  const evs = state.events.filter(e => e.date === sel).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const ts = state.tasks.filter(t => t.due === sel).sort((a, b) => a.done - b.done || byTask(a, b));
  view.innerHTML = `<div class="cal-wrap">
    <section>
      <div class="cal-head">
        <h1>${fmt(m + '-01', { month: 'long', year: 'numeric' })}</h1>
        <button class="btn" data-act="cal-today">اليوم</button>
        <button class="btn" data-act="cal-move" data-n="-1" aria-label="الشهر السابق">›</button>
        <button class="btn" data-act="cal-move" data-n="1" aria-label="الشهر التالي">‹</button>
      </div>
      <div class="grid">${DOW_SHORT.map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div>
    </section>
    <aside class="panel">
      <h3>${fmt(sel, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      <div class="sub" style="font-size:13px">${hijri(sel)}</div>
      <h2 style="margin-top:16px">المواعيد <button class="btn small ghost" data-act="add-event" data-day="${sel}">+ موعد</button></h2>
      ${evs.length ? evs.map(agendaItem).join('') : '<div class="hint" style="padding:0 12px">ما فيه مواعيد</div>'}
      <h2>المهام</h2>
      ${taskList(ts)}
      ${quickAdd({ due: sel, placeholder: 'مهمة لهذا اليوم…' }).replace(/<div class="hint">.*?<\/div>/, '')}
    </aside>
  </div>`;
}

/* ---------- dialogs ---------- */
const dlg = $('#dlg');
function openDialog(html, onSubmit) {
  dlg.innerHTML = `<form method="dialog" class="dlg-form">${html}</form>`;
  const f = dlg.firstElementChild;
  f.addEventListener('submit', e => {
    const v = e.submitter?.value || 'save';
    if (v === 'cancel') return;
    if (onSubmit?.(new FormData(f), v) === false) e.preventDefault();
  });
  dlg.showModal();
  f.querySelector('[autofocus]')?.focus();
}
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
const swatches = (name, sel) => `<div class="swatches">${COLORS.map(c => `<label><input type="radio" name="${name}" value="${c}" ${c === sel ? 'checked' : ''}><span style="--c:${c}"></span></label>`).join('')}</div>`;
const actions = (withDelete) => `<div class="dlg-actions"><button class="btn primary" value="save">حفظ</button><button class="btn" value="cancel" formnovalidate>إلغاء</button><span class="grow"></span>${withDelete ? '<button class="btn danger" value="delete" formnovalidate>حذف</button>' : ''}</div>`;

function taskDialog(id) {
  const t = state.tasks.find(x => x.id === id); if (!t) return;
  openDialog(`<h3>تعديل المهمة</h3>
    <input name="title" class="title-input" value="${esc(t.title)}" required>
    <textarea name="notes" rows="3" placeholder="ملاحظات…">${esc(t.notes)}</textarea>
    <div class="row"><label>التاريخ<input type="date" name="due" value="${t.due || ''}"></label><label>الوقت<input type="time" name="time" value="${t.time || ''}"></label></div>
    <div class="row"><label>الأولوية<select name="priority">${PRI.map((p, i) => `<option value="${i}" ${i === t.priority ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
    <label>القائمة<select name="listId">${state.lists.map(l => `<option value="${l.id}" ${l.id === t.listId ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label></div>
    ${actions(true)}`, (fd, v) => {
    if (v === 'delete') state.tasks = state.tasks.filter(x => x !== t);
    else Object.assign(t, { title: fd.get('title').trim() || t.title, notes: fd.get('notes'), due: fd.get('due') || null, time: fd.get('time') || null, priority: +fd.get('priority'), listId: fd.get('listId') });
    save(); render();
  });
}
function eventDialog(id, day) {
  const ev = id ? state.events.find(x => x.id === id) : { title: '', date: day || todayStr(), start: '09:00', end: '10:00', color: COLORS[1] };
  openDialog(`<h3>${id ? 'تعديل الموعد' : 'موعد جديد'}</h3>
    <input name="title" class="title-input" value="${esc(ev.title)}" placeholder="عنوان الموعد" required autofocus>
    <label>التاريخ<input type="date" name="date" value="${ev.date}" required></label>
    <div class="row"><label>من<input type="time" name="start" value="${ev.start || ''}"></label><label>إلى<input type="time" name="end" value="${ev.end || ''}"></label></div>
    <p class="note">اترك الوقت فاضي إذا الموعد طوال اليوم.</p>
    ${swatches('color', ev.color)}
    ${actions(!!id)}`, (fd, v) => {
    if (v === 'delete') state.events = state.events.filter(x => x.id !== id);
    else {
      const data = { title: fd.get('title').trim(), date: fd.get('date'), start: fd.get('start') || null, end: fd.get('end') || null, color: fd.get('color') || COLORS[1] };
      if (id) Object.assign(ev, data); else state.events.push({ id: uid(), ...data });
      ui.calDay = data.date; ui.calMonth = data.date.slice(0, 7);
    }
    save(); render();
  });
}
function listDialog(id) {
  const l = id ? state.lists.find(x => x.id === id) : { name: '', color: COLORS[2] };
  openDialog(`<h3>${id ? 'تعديل القائمة' : 'قائمة جديدة'}</h3>
    <input name="name" class="title-input" value="${esc(l.name)}" placeholder="اسم القائمة" required autofocus>
    ${swatches('color', l.color)}
    ${id ? '<p class="note">إذا حذفت القائمة، مهامها تنتقل للوارد.</p>' : ''}
    ${actions(!!id)}`, (fd, v) => {
    if (v === 'delete') {
      state.tasks.forEach(t => { if (t.listId === id) t.listId = 'inbox'; });
      state.lists = state.lists.filter(x => x.id !== id); ui.taskFilter = 'inbox';
    } else if (id) Object.assign(l, { name: fd.get('name').trim(), color: fd.get('color') });
    else { const n = { id: uid(), name: fd.get('name').trim(), color: fd.get('color') || COLORS[2] }; state.lists.push(n); ui.taskFilter = n.id; }
    save(); render();
  });
}
function ask(msg, okLabel, onOk) {
  openDialog(`<h3 style="font-size:16px">${msg}</h3><div class="dlg-actions">${okLabel ? `<button class="btn primary" value="ok">${okLabel}</button><button class="btn" value="cancel">إلغاء</button>` : '<button class="btn primary" value="cancel">تمام</button>'}</div>`,
    (fd, v) => { if (v === 'ok') onOk?.(); });
}

/* ---------- actions ---------- */
const A = {
  go: a => go(a.dataset.view),
  toggle: a => {
    const t = state.tasks.find(x => x.id === a.closest('[data-task]').dataset.task);
    t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
    save(); render();
  },
  edit: a => taskDialog(a.closest('[data-task]').dataset.task),
  filter: a => { ui.taskFilter = a.dataset.f; ui.showDone = false; render(); },
  'toggle-done': () => { ui.showDone = !ui.showDone; render(); },
  'add-list': () => listDialog(null),
  'edit-list': () => listDialog(ui.taskFilter),
  'cal-move': a => { const d = parseYmd(ui.calMonth + '-01'); d.setMonth(d.getMonth() + +a.dataset.n); ui.calMonth = ymd(d).slice(0, 7); render(); },
  'cal-today': () => { ui.calDay = todayStr(); ui.calMonth = null; render(); },
  day: a => { ui.calDay = a.dataset.day; if (a.classList.contains('other')) ui.calMonth = a.dataset.day.slice(0, 7); render(); },
  event: a => eventDialog(a.dataset.ev),
  'add-event': a => eventDialog(null, a.dataset.day),
  backup: () => backupDialog(),
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled && A[a.dataset.act]) A[a.dataset.act](a, e);
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (!('quick' in f.dataset)) return;
  e.preventDefault();
  const text = f.elements.q.value.trim(); if (!text) return;
  const p = parseQuick(text, { due: f.dataset.due || null });
  state.tasks.push({ ...newTask(p.title, f.dataset.list || 'inbox', p.due, p.priority), time: p.time });
  save(); render();
  $('form[data-quick] input')?.focus();
});
function toast(msg, ms = 2600) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('on'), ms);
}
const fmtSize = n => n < 1024 ? n + ' بايت' : n < 1048576 ? Math.round(n / 1024) + ' ك.ب' : (n / 1048576).toFixed(1) + ' م.ب';
