'use strict';
/* ---------- focus timer, and the morning plan and evening review ----------
 * The running timer is kept per device with an absolute end time, so it survives a closed app.
 * Finished work goes to state.sessions; each day's plan goes to state.days. Both sync.
 */
const POMO = { work: 25, short: 5, long: 15, every: 4 };
const PHASES = { work: 'تركيز', short: 'استراحة قصيرة', long: 'استراحة طويلة' };
const timer = { mode: 'pomo', phase: 'work', round: 1, taskId: null, customMins: 240, running: false, endAt: 0, left: 0, dur: 0, segStart: 0, worked: 0, started: 0, finished: null };
try { Object.assign(timer, JSON.parse(localStorage.getItem('madar-timer') || '{}')); } catch { /* private mode */ }
const keepTimer = () => { try { localStorage.setItem('madar-timer', JSON.stringify(timer)); } catch { /* ignore */ } };
const pomo = () => ({ ...POMO, ...(state.prefs?.pomo || {}) });
const fmtMins = m => { m = Math.round(m); const h = Math.floor(m / 60); return h ? `${h}س${m % 60 ? ` ${m % 60}د` : ''}` : `${m}د`; };
const fmtClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return `${h ? h + ':' + pad(m) : pad(m)}:${pad(s % 60)}`; };
const fullDur = () => timer.mode === 'stop' ? 0 : (timer.mode === 'custom' ? timer.customMins : pomo()[timer.phase]) * 60000;
const timerActive = () => timer.running || timer.worked > 0 || (timer.dur > 0 && timer.left !== timer.dur);
const isWork = () => timer.mode !== 'pomo' || timer.phase === 'work';
const timerLeft = () => timer.running ? timer.endAt - Date.now() : timer.left;
const workedNow = () => timer.worked + (timer.running && isWork() ? Math.min(Date.now(), timer.endAt || Infinity) - timer.segStart : 0);

function resetClock() { timer.running = false; timer.dur = timer.left = fullDur(); timer.worked = 0; timer.endAt = 0; timer.started = 0; keepTimer(); }
function logWork(ms) {
  if (ms < 60000) return;
  const t = state.tasks.find(x => x.id === timer.taskId);
  state.sessions.push({ id: uid(), taskId: timer.taskId || null, title: t?.title || '', start: timer.started || Date.now() - ms, day: todayStr(), mins: Math.round(ms / 60000), kind: timer.mode });
  save();
}
function startClock() {
  if (timer.running) return;
  if (!timer.dur && timer.mode !== 'stop') timer.dur = timer.left = fullDur();
  timer.running = true; timer.segStart = Date.now(); timer.started ||= Date.now();
  timer.endAt = timer.mode === 'stop' ? 0 : Date.now() + timer.left;
  askNotify(); keepTimer();
  if (ui.view === 'focus') render(); else paintFocus();
}
function pauseClock() {
  if (!timer.running) return;
  timer.worked = workedNow(); timer.left = timer.mode === 'stop' ? 0 : Math.max(0, timer.endAt - Date.now());
  timer.running = false; keepTimer(); paintFocus();
}
function stopClock() {
  logWork(workedNow()); resetClock();
  if (ui.view === 'focus') render(); else paintFocus();
}
function finishClock() {
  const work = isWork();
  timer.worked = workedNow(); logWork(timer.worked);
  const title = !work ? 'خلصت الاستراحة' : timer.mode === 'pomo' ? 'خلصت جلسة التركيز' : 'خلص المؤقت';
  if (timer.mode === 'pomo') {
    if (work) { timer.phase = timer.round % pomo().every === 0 ? 'long' : 'short'; }
    else { if (timer.phase === 'long') timer.round = 0; timer.round++; timer.phase = 'work'; }
  }
  resetClock(); chime(); notify(title);
  toast(`⏰ ${title}`, 6000);
  if (ui.view === 'focus') render(); else paintFocus();
}
function chime() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.28, 0.56].forEach((at, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + at;
      o.frequency.value = [659, 784, 988][i]; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.start(t); o.stop(t + 0.55);
    });
  } catch { /* no sound available */ }
}
const askNotify = () => { try { if (window.Notification?.permission === 'default') Notification.requestPermission(); } catch { /* unsupported */ } };
const notify = text => { try { if (window.Notification?.permission === 'granted') new Notification('مدار', { body: text }); } catch { /* unsupported */ } };

/* ---------- what shows on screen ---------- */
const focusMins = (pred) => (state.sessions || []).filter(pred).reduce((n, s) => n + s.mins, 0);
function focusChips(t) {
  const m = focusMins(s => s.taskId === t.id);
  return (m ? `<span class="chip">⏱ ${fmtMins(m)}</span>` : '') + (t.link ? `<span class="chip link-chip" data-act="task-link" title="افتح الصفحة في الدفتر">📓 الصفحة</span>` : '');
}
function renderFocus() {
  if (!timerActive()) resetClock();
  const td = todayStr(), p = pomo(), open = state.tasks.filter(t => !t.done).sort(byTask);
  const days = Array.from({ length: 7 }, (_, i) => addDays(td, i - 6)), tot = days.map(d => focusMins(s => s.day === d)), max = Math.max(60, ...tot);
  const byT = new Map(); for (const s of state.sessions.filter(x => x.day === td)) { const k = s.taskId || ''; byT.set(k, (byT.get(k) || 0) + s.mins); }
  const locked = timerActive();
  view.innerHTML = `<div class="wrap wide focus-page">
    <div class="focus-main card">
      <div class="seg-tabs focus-modes">${[['pomo', 'بومودورو'], ['custom', 'مؤقت'], ['stop', 'ساعة إيقاف']].map(([k, n]) => `<button class="${timer.mode === k ? 'on' : ''}" data-act="focus-mode" data-m="${k}" ${locked ? 'disabled' : ''}>${n}</button>`).join('')}</div>
      <div class="fring" id="fring"><svg viewBox="0 0 260 260"><circle class="fr-bg" cx="130" cy="130" r="118"/><circle class="fr-on" cx="130" cy="130" r="118" pathLength="1000"/></svg>
        <div class="fr-in"><small id="f-phase"></small><b id="f-clock" dir="ltr"></b><small id="f-sub"></small></div></div>
      ${timer.mode === 'custom' && !locked ? `<div class="f-presets">${[15, 30, 45, 60, 120, 240].map(m => `<button class="chip-btn ${timer.customMins === m ? 'on' : ''}" data-act="focus-mins" data-m="${m}">${fmtMins(m)}</button>`).join('')}
        <label class="f-custom"><input type="number" id="f-h" min="0" max="23" value="${Math.floor(timer.customMins / 60)}"><span>ساعة</span><input type="number" id="f-m" min="0" max="59" value="${timer.customMins % 60}"><span>دقيقة</span></label></div>` : ''}
      <label class="f-task"><span>المهمة</span><select id="f-task"><option value="">بدون مهمة</option>${open.map(t => `<option value="${t.id}" ${t.id === timer.taskId ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>
      <div class="f-btns" id="f-btns"></div>
      ${timer.mode === 'pomo' ? `<details class="f-set"><summary>إعدادات بومودورو</summary><div class="f-set-row">${[['work', 'التركيز'], ['short', 'استراحة قصيرة'], ['long', 'استراحة طويلة'], ['every', 'طويلة كل']].map(([k, n]) => `<label>${n}<input type="number" min="1" max="${k === 'every' ? 12 : 180}" data-pomo="${k}" value="${p[k]}"></label>`).join('')}</div></details>` : ''}
    </div>
    <aside class="focus-side">
      <section class="card"><h3>اليوم</h3><div class="f-total">${fmtMins(focusMins(s => s.day === td))}</div>
        ${[...byT].sort((a, b) => b[1] - a[1]).map(([id, m]) => `<div class="f-row"><span>${esc(state.tasks.find(t => t.id === id)?.title || state.sessions.find(s => s.taskId === id && s.title)?.title || 'بدون مهمة')}</span><b>${fmtMins(m)}</b></div>`).join('') || '<div class="hint">ما بدأت جلسة اليوم</div>'}</section>
      <section class="card"><h3>آخر ٧ أيام</h3><div class="f-bars">${days.map((d, i) => `<div class="f-bar ${d === td ? 'today' : ''}" title="${fmtMins(tot[i])}"><i style="height:${Math.max(3, tot[i] / max * 100)}%"></i><span>${DOW_SHORT[parseYmd(d).getDay()]}</span></div>`).join('')}</div></section>
    </aside></div>`;
  paintFocus();
}
let pill = null;
function paintFocus() {
  const active = timerActive(), left = timerLeft(), clock = timer.mode === 'stop' ? fmtClock(workedNow()) : fmtClock(left);
  const task = state?.tasks?.find(t => t.id === timer.taskId);
  const ring = $('#fring');
  if (ring && ui.view === 'focus') {
    const pct = timer.mode === 'stop' ? 1 : (timer.dur ? Math.max(0, left / timer.dur) : 1);
    ring.classList.toggle('rest', !isWork()); ring.classList.toggle('going', timer.running);
    ring.querySelector('.fr-on').style.strokeDasharray = `${pct * 1000} 1000`;
    $('#f-clock').textContent = clock;
    $('#f-phase').textContent = timer.mode === 'pomo' ? PHASES[timer.phase] : timer.mode === 'stop' ? 'ساعة إيقاف' : 'مؤقت';
    $('#f-sub').textContent = timer.mode === 'pomo' ? `الجولة ${timer.round} من ${pomo().every}` : task ? task.title : '';
    const btns = $('#f-btns'), key = `${timer.running}|${active}|${!!task}`;
    if (btns.dataset.key !== key) {
      btns.dataset.key = key;
      btns.innerHTML = `<button class="btn primary f-go" data-act="${timer.running ? 'focus-pause' : 'focus-start'}">${timer.running ? 'إيقاف مؤقت' : active ? 'كمّل' : 'ابدأ'}</button>
        ${active ? '<button class="btn" data-act="focus-stop">إنهاء وحفظ</button>' : ''}
        ${task && active ? '<button class="btn ghost" data-act="focus-done">خلصت المهمة ✓</button>' : ''}
        ${timer.mode === 'pomo' && !timer.running ? '<button class="btn ghost" data-act="focus-skip">تخطّي</button>' : ''}`;
    }
  }
  pill ||= Object.assign(document.body.appendChild(document.createElement('button')), { id: 'focus-pill' });
  pill.dataset.act = 'go'; pill.dataset.view = 'focus';
  pill.hidden = !active || ui.view === 'focus';
  if (!pill.hidden) { pill.classList.toggle('paused', !timer.running); pill.innerHTML = `<i></i><b dir="ltr">${clock}</b>${task ? `<span>${esc(task.title)}</span>` : ''}`; }
}
setInterval(() => {
  if (typeof state === 'undefined' || !state) return;
  if (timer.running && timer.endAt && Date.now() >= timer.endAt) finishClock();
  else if (timer.running || ui.view === 'focus') paintFocus();
}, 500);
document.addEventListener('change', e => {
  if (e.target.id === 'f-task') { timer.taskId = e.target.value || null; keepTimer(); paintFocus(); }
  if (e.target.id === 'f-h' || e.target.id === 'f-m') {
    timer.customMins = Math.max(1, (+$('#f-h').value || 0) * 60 + (+$('#f-m').value || 0)); resetClock(); render();
  }
  const k = e.target.dataset?.pomo;
  if (k) { state.prefs = { ...(state.prefs || {}), pomo: { ...pomo(), [k]: Math.max(1, +e.target.value || POMO[k]) } }; save(); if (!timerActive()) resetClock(); paintFocus(); }
});

/* ---------- morning plan and evening review ---------- */
const dayOf = ds => state.days.find(d => d.id === ds);
function dayRec(ds) { let d = dayOf(ds); if (!d) { d = { id: ds, top: [] }; state.days.push(d); } return d; }
function planBar() {
  const td = todayStr(), d = dayOf(td), h = new Date().getHours();
  if (d?.reviewed) {
    const done = state.tasks.filter(t => t.doneAt && ymd(new Date(t.doneAt)) === td).length;
    return `<section class="plan-bar done"><b>🌙 راجعت يومك</b><span>${done} مهام خلصت · ${fmtMins(focusMins(s => s.day === td))} تركيز</span></section>`;
  }
  if (!d?.planned) {
    if (h >= 17) return `<section class="plan-bar"><div><b>🌙 راجع يومك</b><span>دقيقة: وش خلص، ووين يروح الباقي</span></div><button class="btn primary" data-act="day-review">ابدأ المراجعة</button></section>`;
    if (ui.planLater) return '';
    return `<section class="plan-bar"><div><b>☀️ خطّط يومك</b><span>دقيقة وحدة: اختر أهم ٣ مهام وحط لها وقت</span></div><button class="btn primary" data-act="day-plan">ابدأ الخطة</button><button class="btn ghost" data-act="plan-later">لاحقًا</button></section>`;
  }
  const top = d.top.map(id => state.tasks.find(t => t.id === id)).filter(Boolean);
  return `<section class="plan-bar plan-top"><div class="plan-head"><b>أهم ${top.length || ''} لليوم</b><button class="btn small ghost" data-act="day-plan">تعديل</button>${h >= 16 ? '<button class="btn small" data-act="day-review">راجع يومك</button>' : ''}</div>
    <div class="plan-list">${top.map(t => `<div class="plan-item ${t.done ? 'done' : ''}" data-task="${t.id}"><button class="check p${t.priority}" data-act="toggle" aria-label="إنجاز"></button><span>${esc(t.title)}</span>${t.time ? `<small>${t.time}</small>` : ''}${t.done ? '' : '<button class="task-focus" data-act="focus-task" aria-label="ابدأ تركيز">▶</button>'}</div>`).join('') || '<span class="hint">ما اخترت مهام</span>'}</div></section>`;
}
function planDialog() {
  const td = todayStr(), d = dayOf(td), chosen = new Set(d?.top || []);
  const rank = t => (t.due && t.due <= td ? 0 : t.due ? 2 : 1);
  const cands = state.tasks.filter(t => !t.done).sort((a, b) => rank(a) - rank(b) || byTask(a, b)).slice(0, 30);
  openDialog(`<h3>☀️ خطة اليوم</h3><div class="hint">اختر ٣ مهام بالكثير. إذا خلصت هذي، يومك ناجح.</div>
    <div class="plan-pick">${cands.map(t => `<label class="plan-row"><input type="checkbox" name="p" value="${t.id}" ${chosen.has(t.id) ? 'checked' : ''}><span>${esc(t.title)}${t.due && t.due < td ? ' <small class="late-txt">متأخرة</small>' : ''}</span><input type="time" name="t_${t.id}" value="${t.time || ''}"></label>`).join('') || '<div class="hint">ما عندك مهام مفتوحة، أضف واحدة تحت.</div>'}</div>
    <input name="fresh" placeholder="مهمة جديدة لليوم (اختياري)" autocomplete="off">${actions(false)}`, fd => {
    const ids = fd.getAll('p').slice(0, 3);
    for (const id of ids) { const t = state.tasks.find(x => x.id === id); t.due = td; t.time = fd.get('t_' + id) || t.time || null; }
    const fresh = fd.get('fresh').trim();
    if (fresh && ids.length < 3) { const q = parseQuick(fresh, { due: td }); const t = { ...newTask(q.title, 'inbox', q.due, q.priority), time: q.time, repeat: q.repeat }; state.tasks.push(t); ids.push(t.id); }
    Object.assign(dayRec(td), { top: ids, planned: true });
    save(); render();
  });
  const boxes = () => [...dlg.querySelectorAll('[name="p"]')];
  const limit = () => { const n = boxes().filter(b => b.checked).length; boxes().forEach(b => { b.disabled = !b.checked && n >= 3; }); };
  boxes().forEach(b => b.addEventListener('change', limit)); limit();
}
function reviewDialog() {
  const td = todayStr();
  const left = state.tasks.filter(t => !t.done && !t.repeat && t.due && t.due <= td);
  const done = state.tasks.filter(t => t.doneAt && ymd(new Date(t.doneAt)) === td).length;
  openDialog(`<h3>🌙 مراجعة اليوم</h3>
    <div class="rev-stats"><div><b>${done}</b><span>مهام خلصت</span></div><div><b>${fmtMins(focusMins(s => s.day === td))}</b><span>تركيز</span></div><div><b>${left.length}</b><span>باقية</span></div></div>
    ${left.length ? `<div class="hint">وين يروح الباقي؟</div><div class="plan-pick">${left.map(t => `<label class="plan-row"><span>${esc(t.title)}</span><select name="r_${t.id}"><option value="tomorrow">بكرة</option><option value="week">الأسبوع الجاي</option><option value="none">بدون تاريخ</option><option value="keep">أخليها</option><option value="del">احذفها</option></select></label>`).join('')}</div>` : '<div class="hint">ما بقى شي، يوم ممتاز 🎉</div>'}
    <label>وش أهم شي أنجزته اليوم؟<textarea name="note" rows="2">${esc(dayOf(td)?.note || '')}</textarea></label>${actions(false)}`, fd => {
    for (const t of left) {
      const v = fd.get('r_' + t.id);
      if (v === 'tomorrow') { t.due = addDays(td, 1); t.time = null; }
      else if (v === 'week') { t.due = addDays(td, 7); t.time = null; }
      else if (v === 'none') { t.due = null; t.time = null; }
      else if (v === 'del') state.tasks = state.tasks.filter(x => x !== t);
    }
    Object.assign(dayRec(td), { reviewed: true, note: fd.get('note').trim() });
    save(); render(); toast('تصبح على خير 🌙');
  });
}

Object.assign(A, {
  'focus-mode': a => { timer.mode = a.dataset.m; timer.phase = 'work'; resetClock(); render(); },
  'focus-mins': a => { timer.customMins = +a.dataset.m; resetClock(); render(); },
  'focus-start': () => startClock(),
  'focus-pause': () => pauseClock(),
  'focus-stop': () => stopClock(),
  'focus-skip': () => { if (timer.mode === 'pomo') { timer.running = false; timer.worked = 0; timer.endAt = Date.now() - 1; timer.running = true; timer.segStart = timer.endAt; finishClock(); } },
  'focus-done': () => {
    const t = state.tasks.find(x => x.id === timer.taskId);
    logWork(workedNow()); if (t) setTaskDone(t, true);
    timer.taskId = null; timer.phase = 'work'; resetClock(); save(); render(); toast('أحسنت، خلصت المهمة 🎉');
  },
  'focus-task': a => {
    const id = a.closest('[data-task]').dataset.task;
    if (timer.running && timer.taskId !== id) { logWork(workedNow()); timer.worked = 0; timer.started = Date.now(); timer.segStart = Date.now(); }
    timer.taskId = id; keepTimer(); go('focus');
  },
  'task-link': a => {
    const t = state.tasks.find(x => x.id === a.closest('[data-task]').dataset.task), nb = state.notebooks.find(n => n.id === t?.link?.nb);
    const i = nb ? nb.pages.findIndex(p => p.id === t.link.pg) : -1;
    if (i < 0) return toast('هذي الصفحة انحذفت');
    nb.last = { page: i, y: 0, zoom: nb.last?.zoom || 1 };
    ui.view = 'ink'; A['open-nb']({ dataset: { nb: nb.id } });
  },
  'day-plan': () => planDialog(),
  'day-review': () => reviewDialog(),
  'plan-later': () => { ui.planLater = true; render(); },
});
