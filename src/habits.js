'use strict';
/* ---------- habits: daily check-ins, streaks and a monthly tracker ---------- */

const HABIT_ICONS = ['💧', '📖', '🏃', '🧘', '🌙', '📿', '🥗', '💊', '✍️', '🎸', '🧹', '🚭', '☀️', '🚶', '💪', '🧠', '💤', '🦷', '📵', '💰'];
const HABIT_IDEAS = [['💧', 'شرب ماء', 8], ['📖', 'قراءة 10 صفحات', 1], ['🏃', 'رياضة', 1], ['🌙', 'نوم بدري', 1], ['📿', 'أذكار الصباح', 1], ['🚶', 'مشي 30 دقيقة', 1]];

const habits = () => (state.habits ||= []).filter(h => !h.archived);
const isDue = (h, ds) => !h.days || h.days.includes(parseYmd(ds).getDay());
const countOn = (h, ds) => h.log?.[ds] || 0;
const doneOn = (h, ds) => countOn(h, ds) >= (h.goal || 1);
function streak(h, upto = todayStr()) {
  let d = upto, n = 0;
  if (!doneOn(h, d)) d = addDays(d, -1); // today isn't over yet
  for (let i = 0; i < 3660; i++, d = addDays(d, -1)) {
    if (h.created && d < h.created) break;
    if (!isDue(h, d)) continue;
    if (doneOn(h, d)) n++; else break;
  }
  return n;
}
function bestStreak(h) {
  let best = 0, cur = 0;
  const start = h.created || Object.keys(h.log || {}).sort()[0] || todayStr();
  for (let d = start; d <= todayStr(); d = addDays(d, 1)) {
    if (!isDue(h, d)) continue;
    if (doneOn(h, d)) best = Math.max(best, ++cur); else if (d < todayStr()) cur = 0;
  }
  return best;
}
function monthRate(h, m) {
  const first = parseYmd(m + '-01'), days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), td = todayStr();
  let due = 0, done = 0;
  for (let i = 1; i <= days; i++) {
    const ds = `${m}-${pad(i)}`;
    if (ds > td || (h.created && ds < h.created) || !isDue(h, ds)) continue;
    due++; if (doneOn(h, ds)) done++;
  }
  return due ? Math.round(done / due * 100) : 0;
}
function logHabit(h, ds, delta) {
  h.log ||= {};
  const goal = h.goal || 1, now = countOn(h, ds);
  const next = delta > 0 && now >= goal ? 0 : Math.max(0, now + delta); // tapping a finished habit clears it
  if (next) h.log[ds] = next; else delete h.log[ds];
  save();
  return next >= goal && now < goal;
}

/* ---------- view ---------- */
function renderHabits() {
  const td = todayStr();
  ui.habitDay ||= td;
  if (ui.habitDay > td) ui.habitDay = td;
  ui.habitMonth ||= td.slice(0, 7);
  const day = ui.habitDay, list = habits();
  const due = list.filter(h => isDue(h, day)), done = due.filter(h => doneOn(h, day)).length;
  const pct = due.length ? Math.round(done / due.length * 100) : 0;
  const week = Array.from({ length: 7 }, (_, i) => addDays(td, i - 6));
  view.innerHTML = `<div class="wrap wide habits">
    <div class="page-head"><div class="ph-title">${ring(pct, 52)}<div><h1>العادات</h1><div class="sub">${due.length ? `${done} من ${due.length} ${day === td ? 'اليوم' : 'في ' + fmt(day, { weekday: 'long', day: 'numeric', month: 'long' })}` : 'ابدأ بعادة صغيرة وكررها كل يوم'}</div></div></div>
      <button class="btn primary" data-act="habit-new">عادة جديدة</button></div>
    <div class="week-strip">${week.map(ds => {
      const dd = list.filter(h => isDue(h, ds)), dn = dd.filter(h => doneOn(h, ds)).length, p = dd.length ? dn / dd.length : 0;
      return `<button class="ws-day ${ds === day ? 'on' : ''} ${ds === td ? 'today' : ''}" data-act="habit-day" data-day="${ds}"><span>${DOW_SHORT[parseYmd(ds).getDay()]}</span><b>${parseYmd(ds).getDate()}</b><i class="ws-ring" style="--p:${Math.round(p * 100)}"></i></button>`;
    }).join('')}</div>
    ${list.length ? `<div class="habit-grid">${list.map(h => habitCard(h, day)).join('')}</div>` : `
      <div class="habit-empty">${EMPTY_ART}<b>ما عندك عادات للحين</b><span>اختر وحدة تبدأ فيها، أو سوّ عادتك الخاصة</span>
        <div class="idea-row">${HABIT_IDEAS.map(([i, n, g]) => `<button class="chip-btn" data-act="habit-idea" data-icon="${i}" data-name="${n}" data-goal="${g}">${i} ${n}</button>`).join('')}</div></div>`}
    ${list.length ? tracker(list) : ''}
  </div>`;
}
function habitCard(h, day) {
  const due = isDue(h, day), cnt = countOn(h, day), goal = h.goal || 1, ok = cnt >= goal, s = streak(h);
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(todayStr(), i - 6));
  return `<div class="habit ${ok ? 'done' : ''} ${due ? '' : 'off'}" data-habit="${h.id}" style="--c:${h.color}">
    <button class="h-check" data-act="habit-tap" aria-label="سجّل">${ok ? '✓' : goal > 1 ? `${cnt}/${goal}` : ''}</button>
    <div class="h-body" data-act="habit-edit">
      <div class="h-top"><span class="h-icon">${h.icon}</span><b>${esc(h.name)}</b></div>
      <div class="h-meta">${s ? `<span class="flame">🔥 ${s} ${s === 1 ? 'يوم' : s === 2 ? 'يومين' : s <= 10 ? 'أيام' : 'يوم'}</span>` : '<span>ابدأ السلسلة اليوم</span>'}${due ? '' : '<span>· مو مجدولة هاليوم</span>'}</div>
      ${goal > 1 ? `<div class="h-segs">${Array.from({ length: Math.min(goal, 12) }, (_, i) => `<i class="${i < cnt ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      <div class="h-dots">${last7.map(ds => `<i class="${doneOn(h, ds) ? 'on' : isDue(h, ds) ? '' : 'off'}" title="${fmt(ds, { weekday: 'long' })}"></i>`).join('')}</div>
    </div>
    ${goal > 1 && cnt > 0 && !ok ? '<button class="h-minus" data-act="habit-minus" aria-label="تراجع">−</button>' : ''}
  </div>`;
}
function tracker(list) {
  const m = ui.habitMonth, first = parseYmd(m + '-01'), days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), td = todayStr();
  const prev = new Date(first); prev.setMonth(prev.getMonth() - 1);
  const next = new Date(first); next.setMonth(next.getMonth() + 1);
  const cols = Array.from({ length: days }, (_, i) => `${m}-${pad(i + 1)}`);
  return `<section class="card tracker">
    <div class="card-head"><h3>متتبع العادات · ${fmt(m + '-01', { month: 'long', year: 'numeric' })}</h3>
      <div class="row"><button class="btn small" data-act="habit-month" data-m="${ymd(prev).slice(0, 7)}">›</button><button class="btn small" data-act="habit-month" data-m="${td.slice(0, 7)}">هذا الشهر</button><button class="btn small" data-act="habit-month" data-m="${ymd(next).slice(0, 7)}" ${ymd(next).slice(0, 7) > td.slice(0, 7) ? 'disabled' : ''}>‹</button></div></div>
    <div class="tr-scroll"><table class="tr">
      <thead><tr><th></th>${cols.map(ds => `<th class="${ds === td ? 'today' : ''}"><span>${DOW_SHORT[parseYmd(ds).getDay()].slice(0, 1)}</span>${parseYmd(ds).getDate()}</th>`).join('')}</tr></thead>
      <tbody>${list.map(h => `<tr data-habit="${h.id}" style="--c:${h.color}">
        <td class="tr-name"><b>${h.icon} ${esc(h.name)}</b><small>🔥 ${streak(h)} · الأفضل ${bestStreak(h)} · ${monthRate(h, m)}%</small></td>
        ${cols.map(ds => {
          const future = ds > td, due = isDue(h, ds), r = Math.min(1, countOn(h, ds) / (h.goal || 1));
          return `<td><button class="cell ${future ? 'future' : ''} ${due ? '' : 'off'} ${r >= 1 ? 'full' : r > 0 ? 'part' : ''}" style="--r:${r}" data-act="habit-cell" data-day="${ds}" ${future ? 'disabled' : ''} title="${fmt(ds, { weekday: 'long', day: 'numeric', month: 'long' })}"></button></td>`;
        }).join('')}
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="hint">اضغط أي مربع عشان تسجّل يوم فات أو تلغيه</div>
  </section>`;
}

/* ---------- dialog ---------- */
function habitDialog(h, preset = {}) {
  const x = h || { name: preset.name || '', icon: preset.icon || HABIT_ICONS[0], color: COLORS[(habits().length + 1) % COLORS.length], goal: +preset.goal || 1, days: null };
  const days = x.days || [0, 1, 2, 3, 4, 5, 6];
  openDialog(`<h3>${h ? 'تعديل العادة' : 'عادة جديدة'}</h3>
    <input name="name" class="title-input" value="${esc(x.name)}" placeholder="مثلاً: قراءة 10 صفحات" required autofocus>
    <span class="note">الأيقونة</span><div class="emoji-grid small">${HABIT_ICONS.map(i => `<label class="emo"><input type="radio" name="icon" value="${i}" ${i === x.icon ? 'checked' : ''}><span>${i}</span></label>`).join('')}</div>
    <span class="note">اللون</span>${swatches('color', x.color)}
    <div class="row"><label>كم مرة في اليوم؟<input type="number" name="goal" min="1" max="30" value="${x.goal || 1}"></label></div>
    <span class="note">الأيام</span><div class="day-pick">${DOW_SHORT.map((d, i) => `<label><input type="checkbox" name="d${i}" ${days.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
    ${h ? '<label class="check-row"><input type="checkbox" name="archive"> أرشفة العادة (تختفي وتنحفظ إنجازاتها)</label>' : ''}
    ${actions(!!h)}`, (fd, v) => {
    if (v === 'delete') return void setTimeout(() => ask(`تحذف «${esc(h.name)}» وكل سجلها؟`, 'حذف', () => { state.habits = state.habits.filter(y => y !== h); save(); render(); }));
    const picked = [0, 1, 2, 3, 4, 5, 6].filter(i => fd.get('d' + i) === 'on');
    const data = { name: fd.get('name').trim(), icon: fd.get('icon') || x.icon, color: fd.get('color') || x.color, goal: Math.max(1, Math.min(30, +fd.get('goal') || 1)), days: picked.length === 7 || !picked.length ? null : picked };
    if (h) Object.assign(h, data, { archived: fd.get('archive') === 'on' });
    else (state.habits ||= []).push({ id: uid(), ...data, created: todayStr(), log: {} });
    save(); render();
  });
}

/* ---------- a little celebration when a habit is done ---------- */
function burst(el) {
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('i'); p.className = 'spark';
    const a = (i / 14) * Math.PI * 2, d = 34 + Math.random() * 26;
    p.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;background:${getComputedStyle(el).getPropertyValue('--c') || '#4f46e5'}`;
    document.body.appendChild(p); setTimeout(() => p.remove(), 700);
  }
}

/* ---------- actions ---------- */
const habitOf = a => state.habits.find(h => h.id === a.closest('[data-habit]').dataset.habit);
Object.assign(A, {
  'habit-new': () => habitDialog(null),
  'habit-idea': a => habitDialog(null, a.dataset),
  'habit-edit': a => habitDialog(habitOf(a)),
  'habit-day': a => { ui.habitDay = a.dataset.day; render(); },
  'habit-month': a => { ui.habitMonth = a.dataset.m; render(); },
  'habit-tap': a => {
    const h = habitOf(a), card = a.closest('.habit');
    const finished = logHabit(h, ui.habitDay, +1);
    if (finished) { card.classList.add('pop'); burst(a); setTimeout(render, 380); } else render();
  },
  'habit-minus': a => { logHabit(habitOf(a), ui.habitDay, -1); render(); },
  'habit-cell': a => {
    const h = habitOf(a), ds = a.dataset.day;
    h.log ||= {};
    if (doneOn(h, ds)) delete h.log[ds]; else h.log[ds] = h.goal || 1;
    save(); render();
  },
});
// right-click a habit card for quick actions
document.addEventListener('contextmenu', e => {
  const card = e.target.closest('.habit[data-habit]'); if (!card) return;
  e.preventDefault();
  const h = state.habits.find(x => x.id === card.dataset.habit);
  showMenu(e.clientX, e.clientY, [
    { label: 'سجّل اليوم', run: () => { h.log ||= {}; h.log[todayStr()] = h.goal || 1; save(); render(); } },
    { label: 'تراجع عن اليوم', run: () => { delete h.log?.[todayStr()]; save(); render(); } },
    '-',
    { label: 'تعديل', run: () => habitDialog(h) },
    { label: 'أرشفة', run: () => { h.archived = true; save(); render(); toast('انأرشفت العادة'); } },
    { label: 'حذف', danger: true, run: () => ask(`تحذف «${esc(h.name)}» وكل سجلها؟`, 'حذف', () => { state.habits = state.habits.filter(y => y !== h); save(); render(); }) },
  ]);
});

/* habits on the Today page */
function todayHabits() {
  const td = todayStr(), list = habits().filter(h => isDue(h, td));
  if (!list.length) return '';
  return `<section class="card habits-card">
    <div class="card-head"><h3>عاداتك اليوم</h3><button class="btn small ghost" data-act="go" data-view="habits">كل العادات</button></div>
    <div class="habit-row">${list.map(h => { const ok = doneOn(h, td), cnt = countOn(h, td), goal = h.goal || 1; return `<div class="hchip ${ok ? 'done' : ''}" data-habit="${h.id}" style="--c:${h.color}"><button class="h-check small" data-act="habit-tap-today" aria-label="سجّل">${ok ? '✓' : goal > 1 ? `${cnt}/${goal}` : ''}</button><span>${h.icon} ${esc(h.name)}</span>${streak(h) ? `<small>🔥 ${streak(h)}</small>` : ''}</div>`; }).join('')}</div>
  </section>`;
}
A['habit-tap-today'] = a => {
  const h = habitOf(a);
  if (logHabit(h, todayStr(), +1)) { burst(a); setTimeout(render, 380); } else render();
};
