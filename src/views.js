'use strict';
/* ---------- Today, Tasks and Calendar views ---------- */

const ring = (pct, size = 56) => `<div class="ring" style="--p:${pct};--s:${size}px"><span>${pct}%</span></div>`;
const minutes = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
const hhmm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const EMPTY_ART = `<svg class="empty-art" viewBox="0 0 120 80" aria-hidden="true"><rect x="22" y="14" width="76" height="56" rx="10" fill="var(--panel2)"/><path d="M38 34l8 8 16-18" stroke="var(--accent)" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="68" y="32" width="20" height="5" rx="2.5" fill="var(--line)"/><rect x="38" y="52" width="50" height="5" rx="2.5" fill="var(--line)"/><circle cx="98" cy="16" r="6" fill="#fde047"/></svg>`;

/* ---------- task rows ---------- */
function taskRow(t, { showList = true } = {}) {
  const l = listOf(t.listId), late = t.due && !t.done && t.due < todayStr();
  const subs = t.subs || [], doneSubs = subs.filter(s => s.done).length, open = ui.openTask === t.id;
  return `<div class="task ${t.done ? 'done' : ''} ${open ? 'open' : ''}" data-task="${t.id}" draggable="true">
    <button class="check p${t.priority}" data-act="toggle" aria-label="إنجاز"></button>
    <div class="task-body" data-act="task-open">
      <div class="task-title" data-act="task-open">${esc(t.title)}</div>
      <div class="task-meta">${t.due ? `<span class="chip ${late ? 'late' : ''}">${dueLabel(t)}</span>` : ''}${subs.length ? `<span class="chip sub-chip"><span class="mini-bar"><i style="width:${doneSubs / subs.length * 100}%"></i></span>${doneSubs}/${subs.length}</span>` : ''}${showList && l.id !== 'inbox' ? `<span class="chip"><span class="dot" style="--c:${l.color}"></span>${esc(l.name)}</span>` : ''}${t.notes ? '<span class="chip">📝</span>' : ''}</div>
      ${open ? `<div class="subs" data-stop>
        ${subs.map(s => `<div class="sub ${s.done ? 'done' : ''}" data-sub="${s.id}"><button class="check small" data-act="sub-toggle" aria-label="إنجاز"></button><span class="sub-text" contenteditable="true" data-sub-edit spellcheck="false">${esc(s.text)}</span><button class="x" data-act="sub-del" aria-label="حذف">×</button></div>`).join('')}
        <form class="sub-add" data-sub-form><input placeholder="أضف مهمة فرعية…" autocomplete="off"></form>
        <div class="sub-tools"><button class="btn small ghost" data-act="edit">تفاصيل المهمة</button></div>
      </div>` : ''}
    </div>
    <button class="task-more" data-act="task-menu" aria-label="خيارات">⋯</button>
  </div>`;
}
const taskList2 = (tasks, opt) => tasks.length ? tasks.map(t => taskRow(t, opt)).join('') : '';

/* ---------- today ---------- */
function agendaItem(e) {
  return `<div class="agenda-item" data-act="event" data-ev="${e.id}" style="--c:${e.color}"><span class="bar"></span><span class="time">${e.start ? `${e.start}${e.end ? ' – ' + e.end : ''}` : 'طوال اليوم'}</span><span>${esc(e.title)}</span></div>`;
}
function timeline(ds) {
  const evs = state.events.filter(e => e.date === ds && e.start);
  const tks = state.tasks.filter(t => t.due === ds && t.time);
  const allDay = state.events.filter(e => e.date === ds && !e.start);
  const starts = [...evs.map(e => minutes(e.start)), ...tks.map(t => minutes(t.time))];
  const from = Math.min(7, ...starts.map(m => Math.floor(m / 60))), to = Math.max(22, ...evs.map(e => Math.ceil(minutes(e.end || e.start) / 60)));
  const H = 46, now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
  let html = `<div class="tl" data-day="${ds}" style="--h:${H}px;height:${(to - from) * H}px" data-from="${from}">`;
  for (let h = from; h < to; h++) html += `<div class="tl-hour" data-act="tl-slot" data-h="${h}" style="top:${(h - from) * H}px"><span>${h}:00</span></div>`;
  for (const e of evs) {
    const s = minutes(e.start), en = Math.max(s + 20, minutes(e.end || hhmm(s + 60)));
    html += `<div class="tl-ev" data-act="event" data-ev="${e.id}" style="--c:${e.color};top:${(s / 60 - from) * H}px;height:${(en - s) / 60 * H - 3}px"><b>${esc(e.title)}</b><small>${e.start}${e.end ? ' – ' + e.end : ''}</small></div>`;
  }
  for (const t of tks) html += `<div class="tl-task ${t.done ? 'done' : ''}" data-act="edit" data-task="${t.id}" style="top:${(minutes(t.time) / 60 - from) * H}px">○ ${esc(t.title)}</div>`;
  if (ds === todayStr() && nowM / 60 >= from && nowM / 60 <= to) html += `<div class="tl-now" style="top:${(nowM / 60 - from) * H}px"></div>`;
  html += '</div>';
  return (allDay.length ? `<div class="tl-allday">${allDay.map(agendaItem).join('')}</div>` : '') + html;
}
function renderToday() {
  const td = todayStr(), h = new Date().getHours();
  const late = state.tasks.filter(t => !t.done && t.due && t.due < td).sort(byTask);
  const today = state.tasks.filter(t => t.due === td).sort((a, b) => a.done - b.done || byTask(a, b));
  const all = [...late, ...today], done = all.filter(t => t.done).length, pct = all.length ? Math.round(done / all.length * 100) : 0;
  const evCount = state.events.filter(e => e.date === td).length;
  const pages = [...state.pages].sort((a, b) => b.updated - a.updated).slice(0, 4);
  const books = [...state.notebooks].sort((a, b) => (b.opened || 0) - (a.opened || 0)).slice(0, 4);
  view.innerHTML = `<div class="wrap wide dash">
    <div class="dash-head"><div>
      <h1>${h < 5 ? 'ليلة سعيدة' : h < 12 ? 'صباح الخير' : h < 17 ? 'نهارك سعيد' : 'مساء الخير'}</h1>
      <div class="sub">${fmt(td, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${hijri(td)}</div>
    </div>
    <div class="stats">
      <button class="stat" data-act="go-filter" data-f="today"><b>${all.length - done}</b><span>مهام باقية</span></button>
      <button class="stat ${late.length ? 'warn' : ''}" data-act="go-filter" data-f="today"><b>${late.length}</b><span>متأخرة</span></button>
      <button class="stat" data-act="go" data-view="calendar"><b>${evCount}</b><span>مواعيد اليوم</span></button>
    </div></div>
    <div class="dash-grid">
      <section class="card tasks-card">
        <div class="card-top">${ring(pct)}<div><b>${all.length ? (done === all.length ? 'خلّصت كل مهام اليوم 🎉' : `أنجزت ${done} من ${all.length}`) : 'يومك فاضي'}</b><small>${all.length && done < all.length ? 'كمّل، باقي شوي' : 'أضف شي تبي تسويه'}</small></div></div>
        ${quickAdd({ due: td, placeholder: 'وش بتسوي اليوم؟' })}
        <div class="card-list">
          ${late.length ? `<h2>متأخرة</h2>${taskList2(late)}` : ''}
          ${today.length ? `${late.length ? '<h2>اليوم</h2>' : ''}${taskList2(today)}` : (!late.length ? `<div class="empty-box">${EMPTY_ART}<span>ما عندك مهام اليوم</span></div>` : '')}
        </div>
      </section>
      <section class="card tl-card">
        <div class="card-head"><h3>جدول اليوم</h3><button class="btn small ghost" data-act="add-event" data-day="${td}">＋ موعد</button></div>
        <div class="tl-scroll">${timeline(td)}</div>
      </section>
      <section class="card qn-card">
        <div class="card-head"><h3>ملاحظة سريعة</h3></div>
        <form data-qn><textarea id="qn" rows="3" placeholder="اكتب فكرة… أول سطر يصير العنوان. ⌘↩ للحفظ"></textarea><div class="row"><span class="grow"></span><button class="btn primary small">حفظ في الملاحظات</button></div></form>
      </section>
      <section class="card recent-card">
        <div class="card-head"><h3>كمّل من وين وقفت</h3></div>
        <div class="recent">
          ${books.map(n => `<button class="rc-book" data-act="open-nb" data-nb="${n.id}" style="--c:${n.color}"><span class="rc-cover">${n.cover ? `<img src="${n.cover}" alt="">` : ''}</span><span><b>${esc(n.name)}</b><small>صفحة ${(n.last?.page || 0) + 1} من ${n.pages.length}</small></span></button>`).join('')}
          ${pages.map(p => `<button class="rc-page" data-act="open-page" data-page="${p.id}"><span class="rc-icon">${p.icon}</span><span><b>${esc(p.title || 'بدون عنوان')}</b><small>${blockPreview(p) || '—'}</small></span></button>`).join('')}
        </div>
      </section>
    </div></div>`;
  const tl = $('.tl-scroll'); const nowEl = $('.tl-now');
  if (tl) tl.scrollTop = nowEl ? Math.max(0, nowEl.offsetTop - 120) : 0;
}

/* ---------- tasks ---------- */
function renderTasks() {
  const td = todayStr();
  const open = state.tasks.filter(t => !t.done);
  const smart = [
    { f: 'today', name: 'اليوم', icon: '☀️', n: open.filter(t => t.due && t.due <= td).length },
    { f: 'upcoming', name: 'الأيام القادمة', icon: '🗓️', n: open.filter(t => t.due && t.due > td && t.due <= addDays(td, 7)).length },
    { f: 'all', name: 'كل المهام', icon: '📋', n: open.length },
    { f: 'done', name: 'المكتملة', icon: '✅', n: '' },
  ];
  if (!state.lists.some(l => l.id === ui.taskFilter) && !smart.some(s => s.f === ui.taskFilter)) ui.taskFilter = 'today';
  const f = ui.taskFilter, list = state.lists.find(l => l.id === f);
  let title, body, addOpts, scope;
  if (f === 'today') {
    title = 'اليوم';
    const late = open.filter(t => t.due && t.due < td).sort(byTask), now = state.tasks.filter(t => t.due === td).sort((a, b) => a.done - b.done || byTask(a, b));
    scope = [...late, ...now];
    body = (late.length ? `<h2>متأخرة</h2>${taskList2(late)}<h2>اليوم</h2>` : '') + (taskList2(now) || `<div class="empty-box">${EMPTY_ART}<span>ما فيه مهام لليوم</span></div>`);
    addOpts = { due: td };
  } else if (f === 'upcoming') {
    title = 'الأيام القادمة'; body = ''; scope = [];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(td, i), ts = state.tasks.filter(t => t.due === d).sort((a, b) => a.done - b.done || byTask(a, b)); scope.push(...ts);
      body += `<div class="day-group" data-drop-day="${d}"><h2>${i === 1 ? 'غداً' : fmt(d, { weekday: 'long' })} · ${fmt(d, { day: 'numeric', month: 'short' })}</h2>${taskList2(ts) || '<div class="drop-hint">اسحب مهمة هنا</div>'}</div>`;
    }
    addOpts = { due: addDays(td, 1) };
  } else if (f === 'all') {
    title = 'كل المهام'; scope = open;
    body = taskList2(open.sort(byTask)) || `<div class="empty-box">${EMPTY_ART}<span>خلصت كل شي 🎉</span></div>`;
    addOpts = {};
  } else if (f === 'done') {
    title = 'المكتملة'; scope = null;
    body = taskList2(state.tasks.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt)) || `<div class="empty-box">${EMPTY_ART}<span>ما فيه مهام مكتملة بعد</span></div>`;
    addOpts = null;
  } else {
    title = `<span class="dot" style="--c:${list.color};width:12px;height:12px"></span> ${esc(list.name)}`;
    const ts = state.tasks.filter(t => t.listId === list.id), o = ts.filter(t => !t.done).sort(byTask), d = ts.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt);
    scope = ts;
    body = (taskList2(o, { showList: false }) || `<div class="empty-box">${EMPTY_ART}<span>القائمة فاضية</span></div>`) +
      (d.length ? `<h2><button class="btn small ghost" data-act="toggle-done">${ui.showDone ? '▾' : '◂'} المكتملة (${d.length})</button></h2>${ui.showDone ? taskList2(d, { showList: false }) : ''}` : '');
    addOpts = { list: list.id };
  }
  const pct = scope && scope.length ? Math.round(scope.filter(t => t.done).length / scope.length * 100) : null;
  view.innerHTML = `<div class="split">
    <aside class="side">
      ${smart.map(s => `<button class="side-item ${f === s.f ? 'active' : ''}" data-act="filter" data-f="${s.f}" data-drop="${s.f}"><span>${s.icon}</span>${s.name}<span class="n">${s.n || ''}</span></button>`).join('')}
      <div class="side-label">القوائم</div>
      ${state.lists.map(l => `<button class="side-item ${f === l.id ? 'active' : ''}" data-act="filter" data-f="${l.id}" data-drop="${l.id}"><span class="dot" style="--c:${l.color}"></span>${esc(l.name)}<span class="n">${open.filter(t => t.listId === l.id).length || ''}</span></button>`).join('')}
      <button class="side-item" data-act="add-list" style="color:var(--muted)">＋ قائمة جديدة</button>
      <div class="side-tip">اسحب أي مهمة على قائمة عشان تنقلها، أو على «اليوم» عشان تخليها لليوم</div>
    </aside>
    <section>
      <div class="page-head"><div class="ph-title">${pct !== null ? ring(pct, 44) : ''}<h1>${title}</h1></div>${list && list.id !== 'inbox' ? '<button class="btn small" data-act="edit-list">تعديل القائمة</button>' : ''}</div>
      ${addOpts ? quickAdd(addOpts) : ''}
      <div class="task-list" style="margin-top:10px">${body}</div>
    </section>
  </div>`;
}

/* complete with a little animation, then update */
function toggleTask(t, el) {
  if (el && !t.done) {
    el.classList.add('completing');
    setTimeout(() => { t.done = true; t.doneAt = Date.now(); save(); render(); }, 420);
  } else { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; save(); render(); }
}

/* ---------- right-click menu ---------- */
let menuEl = null;
function closeMenu() { menuEl?.remove(); menuEl = null; }
function showMenu(x, y, items) {
  closeMenu();
  menuEl = document.createElement('div');
  menuEl.className = 'ctx';
  menuEl.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : it.row ? `<div class="ctx-row">${it.row.map((b, j) => `<button data-i="${i}" data-j="${j}" title="${b.title}">${b.html}</button>`).join('')}</div>` : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.label}</button>`).join('');
  document.body.appendChild(menuEl);
  const r = menuEl.getBoundingClientRect();
  menuEl.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  menuEl.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  menuEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const it = items[+b.dataset.i];
    (b.dataset.j !== undefined ? it.row[+b.dataset.j].run : it.run)();
    closeMenu();
  });
}
document.addEventListener('mousedown', e => { if (menuEl && !e.target.closest('.ctx')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
function taskMenu(t, x, y) {
  const td = todayStr(), set = patch => { Object.assign(t, patch); save(); render(); };
  const nextWeek = addDays(td, ((7 - new Date().getDay()) % 7) || 7);
  showMenu(x, y, [
    { row: [
      { title: 'اليوم', html: '☀️', run: () => set({ due: td }) },
      { title: 'غداً', html: '🌅', run: () => set({ due: addDays(td, 1) }) },
      { title: 'الأسبوع الجاي', html: '🗓️', run: () => set({ due: nextWeek }) },
      { title: 'بدون تاريخ', html: '⊘', run: () => set({ due: null, time: null }) },
    ] },
    { row: [3, 2, 1, 0].map(p => ({ title: PRI[p], html: `<span class="pflag p${p}"></span>`, run: () => set({ priority: p }) })) },
    '-',
    ...state.lists.filter(l => l.id !== t.listId).slice(0, 6).map(l => ({ label: `<span class="dot" style="--c:${l.color}"></span> نقل إلى ${esc(l.name)}`, run: () => set({ listId: l.id }) })),
    '-',
    { label: 'إضافة مهمة فرعية', run: () => { ui.openTask = t.id; render(); setTimeout(() => $(`[data-task="${t.id}"] .sub-add input`)?.focus()); } },
    { label: 'تكرار', run: () => { state.tasks.push({ ...structuredClone(t), id: uid(), created: Date.now(), done: false, doneAt: null }); save(); render(); } },
    { label: 'تفاصيل', run: () => taskDialog(t.id) },
    { label: 'حذف', danger: true, run: () => { state.tasks = state.tasks.filter(x => x !== t); save(); render(); toast('انحذفت المهمة'); } },
  ]);
}
document.addEventListener('contextmenu', e => {
  const row = e.target.closest('[data-task]');
  if (!row || e.target.closest('[contenteditable="true"],input')) return;
  const t = state.tasks.find(x => x.id === row.dataset.task); if (!t) return;
  e.preventDefault(); taskMenu(t, e.clientX, e.clientY);
});

/* ---------- drag tasks onto lists, days and calendar cells ---------- */
let dragTask = null;
document.addEventListener('dragstart', e => {
  const row = e.target.closest?.('.task[data-task], .ev.t[data-task]');
  if (!row || ui.view === 'notes') return;
  dragTask = row.dataset.task;
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragTask);
  setTimeout(() => row.classList.add('dragging'));
});
document.addEventListener('dragend', () => { dragTask = null; $$('.dragging,.drop-on').forEach(x => x.classList.remove('dragging', 'drop-on')); });
const dropTarget = e => e.target.closest?.('[data-drop],[data-drop-day],.day[data-day]');
document.addEventListener('dragover', e => {
  if (!dragTask) return;
  const tg = dropTarget(e); if (!tg) return;
  e.preventDefault();
  $$('.drop-on').forEach(x => x !== tg && x.classList.remove('drop-on')); tg.classList.add('drop-on');
});
document.addEventListener('drop', e => {
  if (!dragTask) return;
  const tg = dropTarget(e); if (!tg) return;
  e.preventDefault();
  const t = state.tasks.find(x => x.id === dragTask); if (!t) return;
  const td = todayStr(), d = tg.dataset;
  if (d.dropDay || d.day) { t.due = d.dropDay || d.day; toast(`صارت ${dueLabel(t)}`); }
  else if (d.drop === 'today') { t.due = td; toast('صارت لليوم'); }
  else if (d.drop === 'upcoming') { t.due = addDays(td, 1); toast('صارت لبكرة'); }
  else if (d.drop === 'done') { t.done = true; t.doneAt = Date.now(); }
  else if (d.drop === 'all') return;
  else if (state.lists.some(l => l.id === d.drop)) { t.listId = d.drop; toast(`انتقلت إلى ${listOf(d.drop).name}`); }
  save(); render();
});

/* ---------- calendar ---------- */
function renderCalendar() {
  ui.calView ||= 'month';
  const sel = ui.calDay, td = todayStr();
  const head = label => `<div class="cal-head">
    <h1>${label}</h1>
    <div class="seg-tabs"><button class="${ui.calView === 'month' ? 'on' : ''}" data-act="cal-view" data-v="month">شهر</button><button class="${ui.calView === 'week' ? 'on' : ''}" data-act="cal-view" data-v="week">أسبوع</button></div>
    <button class="btn" data-act="cal-today">اليوم</button>
    <button class="btn" data-act="cal-move" data-n="-1" aria-label="السابق">›</button>
    <button class="btn" data-act="cal-move" data-n="1" aria-label="التالي">‹</button>
  </div>`;
  if (ui.calView === 'week') return renderWeek(head);
  const m = ui.calMonth || sel.slice(0, 7); ui.calMonth = m;
  const first = parseYmd(m + '-01'), start = new Date(first); start.setDate(1 - first.getDay());
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const ds = ymd(d);
    const evs = state.events.filter(e => e.date === ds).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const ts = state.tasks.filter(t => t.due === ds).sort(byTask);
    const items = [
      ...evs.map(e => `<div class="ev" style="--c:${e.color}" data-act="event" data-ev="${e.id}" draggable="true">${e.start ? e.start + ' ' : ''}${esc(e.title)}</div>`),
      ...ts.map(t => `<div class="ev t ${t.done ? 'done' : ''}" style="--c:${listOf(t.listId).color}" data-act="edit" data-task="${t.id}" draggable="true">${esc(t.title)}</div>`),
    ];
    cells += `<div class="day ${ds.slice(0, 7) !== m ? 'other' : ''} ${ds === td ? 'today' : ''} ${ds === sel ? 'sel' : ''}" data-act="day" data-day="${ds}">
      <span class="day-n">${d.getDate()}</span>${items.slice(0, 3).join('')}${items.length > 3 ? `<span class="more">+${items.length - 3}</span>` : ''}<button class="day-add" data-act="add-event" data-day="${ds}" aria-label="موعد جديد">＋</button></div>`;
  }
  const evs = state.events.filter(e => e.date === sel).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const ts = state.tasks.filter(t => t.due === sel).sort((a, b) => a.done - b.done || byTask(a, b));
  view.innerHTML = `<div class="cal-wrap">
    <section>${head(fmt(m + '-01', { month: 'long', year: 'numeric' }))}
      <div class="grid">${DOW_SHORT.map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div>
      <div class="hint" style="margin-top:8px">اسحب أي موعد أو مهمة ليوم ثاني. دبل كليك على يوم = موعد جديد.</div>
    </section>
    <aside class="panel">
      <h3>${fmt(sel, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      <div class="sub" style="font-size:13px">${hijri(sel)}</div>
      <div class="tl-scroll panel-tl">${timeline(sel)}</div>
      <h2>المهام</h2>
      ${taskList2(ts) || '<div class="hint" style="padding:0 12px">ما فيه مهام</div>'}
      ${quickAdd({ due: sel, placeholder: 'مهمة لهذا اليوم…' }).replace(/<div class="hint">.*?<\/div>/, '')}
    </aside>
  </div>`;
  const nowEl = $('.panel-tl .tl-now'); const tl = $('.panel-tl'); if (tl) tl.scrollTop = nowEl ? Math.max(0, nowEl.offsetTop - 100) : (8 - (+$('.panel-tl .tl')?.dataset.from || 7)) * 46;
}

/* week view: drag on empty time to create, drag a block to move it, drag its bottom edge to resize */
const HOUR = 52, SNAP = 15;
function lanes(evs) {
  const out = new Map(); let group = [], end = -1;
  const flush = () => { const cols = []; for (const e of group) { let c = cols.findIndex(last => last <= e.s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = e.e; out.set(e.ev, { c, n: 0 }); } for (const e of group) out.get(e.ev).n = cols.length; group = []; };
  for (const e of evs.map(ev => ({ ev, s: minutes(ev.start), e: Math.max(minutes(ev.start) + 20, minutes(ev.end || hhmm(minutes(ev.start) + 60))) })).sort((a, b) => a.s - b.s)) {
    if (e.s >= end && group.length) flush();
    group.push(e); end = Math.max(end, e.e);
  }
  if (group.length) flush();
  return out;
}
function renderWeek(head) {
  const ws = weekStart(ui.calDay), td = todayStr();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const label = `${fmt(ws, { day: 'numeric', month: 'long' })} – ${fmt(days[6], { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
  const cols = days.map(ds => {
    const evs = state.events.filter(e => e.date === ds && e.start), ln = lanes(evs);
    return `<div class="wk-col ${ds === td ? 'today' : ''}" data-day="${ds}">
      ${evs.map(e => { const s = minutes(e.start), en = Math.max(s + 20, minutes(e.end || hhmm(s + 60))), L = ln.get(e);
        return `<div class="wk-ev" data-ev="${e.id}" style="--c:${e.color};top:${s / 60 * HOUR}px;height:${(en - s) / 60 * HOUR - 2}px;right:calc(${L.c / L.n * 100}% + 2px);width:calc(${100 / L.n}% - 4px)"><b>${esc(e.title)}</b><small>${e.start}${e.end ? ' – ' + e.end : ''}</small><span class="wk-rs"></span></div>`; }).join('')}
      ${state.tasks.filter(t => t.due === ds && t.time).map(t => `<div class="wk-task ${t.done ? 'done' : ''}" data-act="edit" data-task="${t.id}" style="top:${minutes(t.time) / 60 * HOUR}px">○ ${esc(t.title)}</div>`).join('')}
      ${ds === td ? `<div class="tl-now" style="top:${nowM / 60 * HOUR}px"></div>` : ''}
    </div>`;
  }).join('');
  view.innerHTML = `<div class="week-wrap">${head(label)}
    <div class="week">
      <div class="wk-row wk-head"><div class="wk-gutter"></div>${days.map(ds => `<button class="wk-day ${ds === td ? 'today' : ''} ${ds === ui.calDay ? 'sel' : ''}" data-act="wk-pick" data-day="${ds}"><span>${DOW_SHORT[parseYmd(ds).getDay()]}</span><b>${parseYmd(ds).getDate()}</b></button>`).join('')}</div>
      <div class="wk-row wk-all"><div class="wk-gutter">طوال اليوم</div>${days.map(ds => `<div class="wk-allcell" data-drop-day="${ds}">${state.events.filter(e => e.date === ds && !e.start).map(e => `<div class="ev" style="--c:${e.color}" data-act="event" data-ev="${e.id}">${esc(e.title)}</div>`).join('')}${state.tasks.filter(t => t.due === ds && !t.time).map(t => `<div class="ev t ${t.done ? 'done' : ''}" style="--c:${listOf(t.listId).color}" data-act="edit" data-task="${t.id}" draggable="true">${esc(t.title)}</div>`).join('')}</div>`).join('')}</div>
      <div class="wk-body"><div class="wk-inner" style="height:${24 * HOUR}px">
        <div class="wk-hours">${Array.from({ length: 24 }, (_, h) => `<span style="top:${h * HOUR}px">${h ? h + ':00' : ''}</span>`).join('')}</div>
        <div class="wk-cols" style="--hh:${HOUR}px">${cols}</div>
      </div></div>
    </div>
    <div class="hint" style="margin-top:8px">اسحب على وقت فاضي عشان تسوي موعد · اسحب الموعد عشان تنقله · اسحب طرفه السفلي عشان تطوّله</div>
  </div>`;
  const body = $('.wk-body');
  body.scrollTop = ui.wkScroll ?? Math.max(0, (Math.min(nowM / 60, 17) - 2) * HOUR);
  body.addEventListener('scroll', () => { ui.wkScroll = body.scrollTop; });
  setupWeekDrag($('.wk-cols'));
}
function setupWeekDrag(colsEl) {
  let op = null;
  const colAt = x => [...colsEl.children].find(c => { const r = c.getBoundingClientRect(); return x >= r.left && x <= r.right; });
  const minAt = (col, y) => Math.max(0, Math.min(24 * 60, Math.round(((y - col.getBoundingClientRect().top) / HOUR * 60) / SNAP) * SNAP));
  colsEl.addEventListener('pointerdown', e => {
    if (e.button > 0 || e.target.closest('.wk-task')) return;
    const evEl = e.target.closest('.wk-ev'), col = e.target.closest('.wk-col'); if (!col) return;
    e.preventDefault();
    try { colsEl.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    if (evEl) {
      const ev = state.events.find(x => x.id === evEl.dataset.ev);
      op = { kind: e.target.closest('.wk-rs') ? 'resize' : 'move', ev, el: evEl, x0: e.clientX, y0: e.clientY, s: minutes(ev.start), en: minutes(ev.end || hhmm(minutes(ev.start) + 60)), moved: false };
      evEl.classList.add('lift');
    } else {
      const m = minAt(col, e.clientY);
      const ghost = document.createElement('div'); ghost.className = 'wk-ev ghost'; col.appendChild(ghost);
      op = { kind: 'new', col, m0: m, m1: m + 60, ghost, y0: e.clientY, moved: false };
      paintGhost(op);
    }
  });
  const paintGhost = o => { const a = Math.min(o.m0, o.m1), b = Math.max(o.m0, o.m1); o.ghost.style.cssText = `top:${a / 60 * HOUR}px;height:${(b - a) / 60 * HOUR - 2}px;right:2px;width:calc(100% - 4px)`; o.ghost.innerHTML = `<small>${hhmm(a)} – ${hhmm(b)}</small>`; };
  colsEl.addEventListener('pointermove', e => {
    if (!op) return;
    if (Math.abs(e.clientY - (op.y0)) > 4 || Math.abs(e.clientX - (op.x0 ?? e.clientX)) > 4) op.moved = true;
    if (op.kind === 'new') { const m = minAt(op.col, e.clientY); op.m1 = m === op.m0 ? op.m0 + 60 : m + (m > op.m0 ? 0 : 0); if (op.moved) paintGhost(op); return; }
    const dm = Math.round(((e.clientY - op.y0) / HOUR * 60) / SNAP) * SNAP;
    if (op.kind === 'move') {
      const col = colAt(e.clientX) || op.el.parentElement;
      if (col !== op.el.parentElement) col.appendChild(op.el);
      const s = Math.max(0, Math.min(24 * 60 - (op.en - op.s), op.s + dm));
      op.ns = s; op.ne = s + (op.en - op.s); op.day = col.dataset.day;
      op.el.style.top = s / 60 * HOUR + 'px'; op.el.style.right = '2px'; op.el.style.width = 'calc(100% - 4px)';
      op.el.querySelector('small').textContent = `${hhmm(op.ns)} – ${hhmm(op.ne)}`;
    } else {
      op.ne = Math.max(op.s + SNAP, Math.min(24 * 60, op.en + dm)); op.ns = op.s;
      op.el.style.height = (op.ne - op.s) / 60 * HOUR - 2 + 'px';
      op.el.querySelector('small').textContent = `${hhmm(op.ns)} – ${hhmm(op.ne)}`;
    }
  });
  colsEl.addEventListener('pointerup', () => {
    if (!op) return;
    const o = op; op = null;
    if (o.kind === 'new') {
      const a = Math.min(o.m0, o.m1), b = Math.max(o.m0, o.m1);
      o.ghost.remove();
      eventDialog(null, o.col.dataset.day, hhmm(a), hhmm(Math.min(b, 23 * 60 + 59)));
      return;
    }
    o.el.classList.remove('lift');
    if (!o.moved) return eventDialog(o.ev.id);
    Object.assign(o.ev, { start: hhmm(o.ns), end: hhmm(Math.min(o.ne, 23 * 60 + 59)), ...(o.day ? { date: o.day } : {}) });
    save(); render(); toast(`${o.ev.title}: ${o.ev.start} – ${o.ev.end}`);
  });
}

/* month view: drag events between days */
document.addEventListener('dragstart', e => {
  const ev = e.target.closest?.('.ev[data-ev]'); if (!ev) return;
  e.dataTransfer.setData('text/x-event', ev.dataset.ev); e.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/x-event') && e.target.closest?.('.day[data-day],[data-drop-day]')) e.preventDefault(); });
document.addEventListener('drop', e => {
  const id = e.dataTransfer.getData('text/x-event'); if (!id) return;
  const cell = e.target.closest?.('.day[data-day],[data-drop-day]'); if (!cell) return;
  e.preventDefault();
  const ev = state.events.find(x => x.id === id); if (!ev) return;
  ev.date = cell.dataset.day || cell.dataset.dropDay; save(); render(); toast(`انتقل «${ev.title}» إلى ${fmt(ev.date, { weekday: 'long', day: 'numeric', month: 'long' })}`);
});
document.addEventListener('dblclick', e => {
  const cell = e.target.closest('.day[data-day]'); if (!cell || e.target.closest('.ev')) return;
  eventDialog(null, cell.dataset.day);
});

/* ---------- actions ---------- */
Object.assign(A, {
  toggle: a => { const row = a.closest('[data-task]'); const t = state.tasks.find(x => x.id === row.dataset.task); if (t) toggleTask(t, row.classList.contains('task') ? row : null); },
  'task-open': (a, e) => {
    if (e.target.closest('[data-stop]')) return;
    const id = a.closest('[data-task]').dataset.task;
    ui.openTask = ui.openTask === id ? null : id; render();
  },
  'task-menu': (a, e) => { const t = state.tasks.find(x => x.id === a.closest('[data-task]').dataset.task); const r = a.getBoundingClientRect(); taskMenu(t, r.left, r.bottom + 4); },
  'sub-toggle': a => { const t = state.tasks.find(x => x.id === a.closest('[data-task]').dataset.task), s = t.subs.find(x => x.id === a.closest('[data-sub]').dataset.sub); s.done = !s.done; save(); render(); },
  'sub-del': a => { const t = state.tasks.find(x => x.id === a.closest('[data-task]').dataset.task); t.subs = t.subs.filter(x => x.id !== a.closest('[data-sub]').dataset.sub); save(); render(); },
  'go-filter': a => go('tasks', { taskFilter: a.dataset.f }),
  'cal-view': a => { ui.calView = a.dataset.v; render(); },
  'cal-move': a => {
    const n = +a.dataset.n;
    if (ui.calView === 'week') { ui.calDay = addDays(ui.calDay, 7 * n); }
    else { const d = parseYmd(ui.calMonth + '-01'); d.setMonth(d.getMonth() + n); ui.calMonth = ymd(d).slice(0, 7); }
    render();
  },
  'wk-pick': a => { ui.calDay = a.dataset.day; render(); },
  'tl-slot': a => { const tl = a.closest('.tl'); eventDialog(null, tl.dataset.day, `${pad(a.dataset.h)}:00`, `${pad(+a.dataset.h + 1)}:00`); },
});
document.addEventListener('submit', e => {
  const f = e.target;
  if ('subForm' in f.dataset) {
    e.preventDefault();
    const inp = f.querySelector('input'), v = inp.value.trim(); if (!v) return;
    const t = state.tasks.find(x => x.id === f.closest('[data-task]').dataset.task);
    (t.subs ||= []).push({ id: uid(), text: v, done: false }); save(); render();
    $(`[data-task="${t.id}"] .sub-add input`)?.focus();
  }
  if ('qn' in f.dataset) {
    e.preventDefault();
    const v = $('#qn').value.trim(); if (!v) return;
    window.trayApi.newNote(v); $('#qn').value = ''; toast('انحفظت في الملاحظات'); render();
  }
}, true);
document.addEventListener('keydown', e => {
  if (e.target.id === 'qn' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.target.form.requestSubmit(); }
  if (e.target.matches?.('[data-sub-edit]') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});
document.addEventListener('focusout', e => {
  if (!e.target.matches?.('[data-sub-edit]')) return;
  const t = state.tasks.find(x => x.id === e.target.closest('[data-task]').dataset.task), s = t?.subs.find(x => x.id === e.target.closest('[data-sub]').dataset.sub);
  if (s) { s.text = e.target.textContent.trim() || s.text; save(); }
});
