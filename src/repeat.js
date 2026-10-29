'use strict';
/* ---------- repeating tasks ----------
 * t.repeat = { kind: 'daily' | 'days' | 'weekly' | 'monthly' | 'every', days: [0-6], n: 2 }
 * Completing a repeating task keeps a done copy in history and moves the task to its next date.
 */
const WORKDAYS = [0, 1, 2, 3, 4]; // Sunday to Thursday

function nextDue(rep, from) {
  if (!rep) return null;
  if (rep.kind === 'daily') return addDays(from, 1);
  if (rep.kind === 'every') return addDays(from, Math.max(1, rep.n || 2));
  if (rep.kind === 'weekly') return addDays(from, 7);
  if (rep.kind === 'monthly') {
    const d = parseYmd(from), day = d.getDate();
    const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    n.setDate(Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()));
    return ymd(n);
  }
  if (rep.kind === 'days' && rep.days?.length) {
    for (let i = 1; i <= 7; i++) { const d = addDays(from, i); if (rep.days.includes(parseYmd(d).getDay())) return d; }
  }
  return addDays(from, 1);
}
// the first date on or after `from` that fits the rule
function firstDue(rep, from = todayStr()) {
  if (rep?.kind === 'days' && rep.days?.length && !rep.days.includes(parseYmd(from).getDay())) return nextDue(rep, from);
  return from;
}
function repeatLabel(rep) {
  if (!rep) return '';
  if (rep.kind === 'daily') return 'يوميًا';
  if (rep.kind === 'weekly') return 'أسبوعيًا';
  if (rep.kind === 'monthly') return 'شهريًا';
  if (rep.kind === 'every') return rep.n === 2 ? 'كل يومين' : `كل ${rep.n} أيام`;
  if (rep.kind === 'days') {
    const d = [...rep.days].sort();
    if (d.join() === WORKDAYS.join()) return 'أيام الدوام';
    if (d.join() === '5,6') return 'الويكند';
    return d.map(i => DOW_SHORT[i]).join('، ');
  }
  return '';
}
// pull a repeat rule out of quick-add text: «كل يوم»، «يوميًا»، «كل أحد وثلاثاء»، «أيام الدوام»، «كل 3 أيام»
function parseRepeat(text) {
  let t = ' ' + text + ' ', rep = null;
  const cut = re => { const m = t.match(re); if (m) t = t.replace(m[0], ' '); return m; };
  if (cut(/\s(كل يوم|يومي[اًا]?|يوميًا)(?=\s)/)) rep = { kind: 'daily' };
  else if (cut(/\s(أيام|ايام) (الدوام|العمل)(?=\s)/)) rep = { kind: 'days', days: WORKDAYS };
  else if (cut(/\s(كل )?(الويكند|ويكند|نهاية الأسبوع)(?=\s)/)) rep = { kind: 'days', days: [5, 6] };
  else if (cut(/\s(كل (أسبوع|اسبوع)|أسبوعي[اًا]?|اسبوعيا|أسبوعيًا)(?=\s)/)) rep = { kind: 'weekly' };
  else if (cut(/\s(كل شهر|شهري[اًا]?|شهريًا)(?=\s)/)) rep = { kind: 'monthly' };
  else if (cut(/\sكل يومين(?=\s)/)) rep = { kind: 'every', n: 2 };
  else {
    const m = cut(/\sكل (\d{1,2}) (أيام|ايام|يوم)(?=\s)/);
    if (m) rep = { kind: 'every', n: +m[1] };
    else {
      // «كل أحد وثلاثاء» / «كل سبت و الاثنين»
      const names = Object.keys(WEEKDAY_WORDS).map(w => w.replace(/^ال/, '')).sort((a, b) => b.length - a.length).join('|');
      const dm = t.match(new RegExp(`\\sكل ((?:ال)?(?:${names})(?:\\s*و\\s*(?:ال)?(?:${names}))*)(?=\\s)`));
      if (dm) {
        const days = [...new Set(dm[1].split(/\s*و\s*/).map(w => WEEKDAY_WORDS['ال' + w.replace(/^ال/, '')]).filter(d => d !== undefined))];
        if (days.length) { rep = { kind: 'days', days }; t = t.replace(dm[0], ' '); }
      }
    }
  }
  return { repeat: rep, text: t.replace(/\s+/g, ' ').trim() };
}
// done or undone, for every place that ticks a task
function setTaskDone(t, done) {
  if (done && t.repeat) {
    state.tasks.push({ ...structuredClone(t), id: uid(), repeat: null, repeatOf: t.id, done: true, doneAt: Date.now(), due: t.due || todayStr() });
    const td = todayStr();
    let n = nextDue(t.repeat, t.due || td);
    for (let i = 0; i < 400 && n < td; i++) n = nextDue(t.repeat, n);
    t.due = n; t.done = false; t.doneAt = null;
    for (const s of t.subs || []) s.done = false;
    return n;
  }
  t.done = done; t.doneAt = done ? Date.now() : null;
  return null;
}
// upcoming dates of a repeating task inside [from, to], after its current date
function occurrences(t, from, to) {
  if (!t.repeat || !t.due || t.done) return [];
  const out = [];
  for (let d = nextDue(t.repeat, t.due), i = 0; d <= to && i < 400; d = nextDue(t.repeat, d), i++) if (d >= from) out.push(d);
  return out;
}

/* the repeat part of the task dialog */
function repeatFields(rep) {
  const kind = rep?.kind || 'none', days = rep?.days || [];
  return `<div class="rep">
    <label>التكرار<select name="repeat" data-repeat>
      ${[['none', 'ما يتكرر'], ['daily', 'كل يوم'], ['days', 'أيام أختارها'], ['weekly', 'كل أسبوع'], ['monthly', 'كل شهر'], ['every', 'كل عدد أيام']].map(([k, n]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${n}</option>`).join('')}
    </select></label>
    <div class="rep-days day-pick" ${kind === 'days' ? '' : 'hidden'}>${DOW_SHORT.map((d, i) => `<label><input type="checkbox" name="rd${i}" ${days.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}
      <button type="button" class="btn small ghost" data-rep-preset="work">أيام الدوام</button></div>
    <label class="rep-n" ${kind === 'every' ? '' : 'hidden'}>كل كم يوم؟<input type="number" name="repn" min="2" max="60" value="${rep?.n || 2}"></label>
  </div>`;
}
function readRepeat(fd) {
  const k = fd.get('repeat');
  if (!k || k === 'none') return null;
  if (k === 'days') { const days = [0, 1, 2, 3, 4, 5, 6].filter(i => fd.get('rd' + i) === 'on'); return days.length ? (days.length === 7 ? { kind: 'daily' } : { kind: 'days', days }) : null; }
  if (k === 'every') return { kind: 'every', n: Math.max(2, Math.min(60, +fd.get('repn') || 2)) };
  return { kind: k };
}
document.addEventListener('change', e => {
  if (!e.target.matches('[data-repeat]')) return;
  const box = e.target.closest('.rep');
  box.querySelector('.rep-days').hidden = e.target.value !== 'days';
  box.querySelector('.rep-n').hidden = e.target.value !== 'every';
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-rep-preset]'); if (!b) return;
  const box = b.closest('.rep');
  box.querySelectorAll('.rep-days input').forEach((inp, i) => { inp.checked = WORKDAYS.includes(i); });
});
