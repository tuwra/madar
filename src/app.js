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
  if (store.ready) store.saveState(state).then(() => desktop?.changed?.()).catch(err => { console.error('save failed', err); toast('ما قدرت أحفظ التغييرات: ' + err.message); });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('pagehide', flush);

function newTask(title, listId = 'inbox', due = null, priority = 0) {
  return { id: uid(), title, listId, due, time: null, priority, notes: '', done: false, doneAt: null, created: Date.now() };
}
function seed() {
  const t = todayStr();
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
    pages: guidePages(),
    notebooks: [sampleNotebook(), { id: uid(), name: 'دفتري الأول', color: '#f59e0b', paper: 'lined', pages: [{ id: uid(), strokes: [] }] }],
    onboarding: 2,
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
  ({ today: renderToday, tasks: renderTasks, habits: renderHabits, calendar: renderCalendar, notes: renderNotes, ink: renderInk })[ui.view]();
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

function quickAdd({ due = '', list = '', placeholder = 'أضف مهمة…' } = {}) {
  return `<form class="quick" data-quick data-due="${due}" data-list="${list}">
    <input name="q" autocomplete="off" placeholder="${placeholder}">
    <div class="hint">جرّب: «اليوم» أو «بكرة» أو اسم يوم، ووقت مثل 5:30، و ! أو !! أو !!! للأولوية</div>
  </form>`;
}
const taskList = (tasks, opt) => tasks.length ? tasks.map(t => taskRow(t, opt)).join('') : '';

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
function eventDialog(id, day, start = '09:00', end = '10:00') {
  const ev = id ? state.events.find(x => x.id === id) : { title: '', date: day || todayStr(), start, end, color: COLORS[1] };
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
/* ---------- what the menu bar window asks for ---------- */
window.trayApi = {
  summary() {
    const td = todayStr();
    const tasks = state.tasks.filter(t => t.due && (t.due < td ? !t.done : t.due === td) || (t.done && t.doneAt && ymd(new Date(t.doneAt)) === td && t.due && t.due <= td))
      .sort((a, b) => a.done - b.done || byTask(a, b))
      .map(t => {
        const l = listOf(t.listId), late = !t.done && t.due < td;
        const meta = [late ? dueLabel(t) : t.time, l.id !== 'inbox' ? l.name : ''].filter(Boolean).join(' · ');
        return { id: t.id, title: t.title, done: t.done, priority: t.priority, late, meta };
      });
    const events = state.events.filter(e => e.date === td).sort((a, b) => (a.start || '').localeCompare(b.start || ''))
      .map(e => ({ title: e.title, color: e.color, time: e.start ? `${e.start}${e.end ? ' – ' + e.end : ''}` : 'طوال اليوم' }));
    const hab = (state.habits || []).filter(h => !h.archived && isDue(h, td)).map(h => ({ id: h.id, icon: h.icon, name: h.name, color: h.color, done: doneOn(h, td), cnt: countOn(h, td), goal: h.goal || 1 }));
    return { dateLabel: fmt(td, { weekday: 'long', day: 'numeric', month: 'long' }), hijri: hijri(td), tasks, events, habits: hab, open: tasks.filter(t => !t.done).length };
  },
  refreshView() { if (['today', 'tasks', 'calendar'].includes(ui.view) && !$('#dlg').open && !document.activeElement?.closest?.('form[data-quick]')) render(); },
  toggle(id) {
    const t = state.tasks.find(x => x.id === id);
    if (t) { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; flush(); this.refreshView(); }
    return this.summary();
  },
  add(text) {
    const p = parseQuick(text, { due: todayStr() });
    state.tasks.push({ ...newTask(p.title, 'inbox', p.due, p.priority), time: p.time });
    flush(); this.refreshView();
    return this.summary();
  },
  open(v) { if (ui.view !== v || v === 'ink') go(v, v === 'ink' ? { notebookId: null } : {}); },

  /* calendar tab */
  month(m) {
    const td = todayStr(); m ||= td.slice(0, 7);
    const first = parseYmd(m + '-01'), start = new Date(first); start.setDate(1 - first.getDay());
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); const ds = ymd(d);
      const dots = [...state.events.filter(e => e.date === ds).map(e => e.color), ...state.tasks.filter(t => t.due === ds && !t.done).map(t => listOf(t.listId).color)].slice(0, 3);
      days.push({ ds, n: d.getDate(), other: ds.slice(0, 7) !== m, today: ds === td, dots });
    }
    const prev = new Date(first); prev.setMonth(prev.getMonth() - 1);
    const next = new Date(first); next.setMonth(next.getMonth() + 1);
    return { m, label: fmt(m + '-01', { month: 'long', year: 'numeric' }), dow: DOW_SHORT, days, prev: ymd(prev).slice(0, 7), next: ymd(next).slice(0, 7) };
  },
  day(ds) {
    const td = todayStr();
    return {
      ds, label: ds === td ? 'اليوم' : fmt(ds, { weekday: 'long', day: 'numeric', month: 'long' }), hijri: hijri(ds),
      events: state.events.filter(e => e.date === ds).sort((a, b) => (a.start || '').localeCompare(b.start || '')).map(e => ({ id: e.id, title: e.title, color: e.color, time: e.start ? `${e.start}${e.end ? ' – ' + e.end : ''}` : 'طوال اليوم' })),
      tasks: state.tasks.filter(t => t.due === ds).sort((a, b) => a.done - b.done || byTask(a, b)).map(t => ({ id: t.id, title: t.title, done: t.done, priority: t.priority, meta: t.time || '' })),
    };
  },
  addOn(ds, text) {
    // "اجتماع 10:00" with a time becomes an appointment, anything else a task for that day
    const p = parseQuick(text, { due: ds });
    if (p.time && !/!/.test(text)) {
      const [h, mi] = p.time.split(':').map(Number);
      state.events.push({ id: uid(), title: p.title, date: p.due || ds, start: p.time, end: `${pad(Math.min(23, h + 1))}:${pad(mi)}`, color: COLORS[1] });
    } else state.tasks.push({ ...newTask(p.title, 'inbox', p.due || ds, p.priority), time: p.time });
    flush(); this.refreshView();
    return this.day(ds);
  },
  toggleOn(ds, id) { this.toggle(id); return this.day(ds); },
  habitTap(id) { const h = (state.habits || []).find(x => x.id === id); if (h) { logHabit(h, todayStr(), +1); flush(); this.refreshView(); if (ui.view === 'habits') render(); } return this.summary(); },

  /* notes tab */
  pages(q = '') {
    q = q.trim();
    return [...state.pages].sort((a, b) => b.updated - a.updated)
      .filter(p => !q || p.title.includes(q) || p.blocks.some(b => textOf(b).includes(q)))
      .slice(0, 40).map(p => ({ id: p.id, icon: p.icon, title: p.title || 'بدون عنوان', preview: blockPreview(p).replace(/&[a-z#0-9]+;/g, ' '), when: relTime(p.updated) }));
  },
  page(id) {
    const p = state.pages.find(x => x.id === id); if (!p) return null;
    return { id: p.id, icon: p.icon, title: p.title || 'بدون عنوان', blocks: p.blocks.map(b => ({ id: b.id, type: b.type, text: textOf(b), checked: !!b.checked, lang: b.lang })) };
  },
  toggleBlock(pid, bid) {
    const p = state.pages.find(x => x.id === pid), b = p?.blocks.find(x => x.id === bid);
    if (b && b.type === 'todo') { b.checked = !b.checked; p.updated = Date.now(); flush(); if (ui.view === 'notes' && curPage === p) renderBlocks(); }
    return this.page(pid);
  },
  appendToPage(pid, text) {
    const p = state.pages.find(x => x.id === pid); if (!p || !text.trim()) return this.page(pid);
    const todo = /^\[ ?\]\s*/.test(text);
    p.blocks.push(blk(todo ? 'todo' : 'p', esc(text.replace(/^\[ ?\]\s*/, '')))); p.updated = Date.now(); flush();
    if (ui.view === 'notes' && curPage === p) renderBlocks();
    return this.page(pid);
  },
  newNote(text) {
    const [first, ...rest] = text.trim().split('\n');
    const p = blankPage(); p.title = first.slice(0, 80);
    p.blocks = rest.length ? rest.map(l => blk('p', esc(l))) : [blk('p')];
    state.pages.push(p); flush();
    if (ui.view === 'notes') renderPageList();
    return p.id;
  },
  openPage(id) { go('notes', { pageId: id }); },

  /* notebooks tab */
  notebooks() {
    return [...state.notebooks].sort((a, b) => (b.opened || 0) - (a.opened || 0)).slice(0, 12)
      .map(n => ({ id: n.id, name: n.name, color: n.color, cover: n.cover || null, pages: n.pages.length, kind: n.kind, page: (n.last?.page || 0) + 1, land: pageW(n.pages[0] || {}) > pageH(n.pages[0] || {}) }));
  },
  openNotebook(id) { A['open-nb']({ dataset: { nb: id } }); if (ui.view !== 'ink') go('ink'); },
};
function relTime(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'الحين'; if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60); if (h < 24) return `قبل ${h} س`;
  const d = Math.round(h / 24); return d === 1 ? 'أمس' : d < 30 ? `قبل ${d} يوم` : fmt(ymd(new Date(t)), { day: 'numeric', month: 'short' });
}

function toast(msg, ms = 2600) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('on'), ms);
}
const fmtSize = n => n < 1024 ? n + ' بايت' : n < 1048576 ? Math.round(n / 1024) + ' ك.ب' : (n / 1048576).toFixed(1) + ' م.ب';
