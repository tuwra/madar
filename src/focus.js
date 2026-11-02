'use strict';
/* ---------- focus timer, and the morning plan and evening review ----------
 * The running timer is kept per device with an absolute end time, so it survives a closed app.
 * Finished work goes to state.sessions; each day's plan goes to state.days. Both sync.
 */
const POMO = { work: 25, short: 5, long: 15, every: 4 };
const PHASES = { work: 'تركيز', short: 'استراحة قصيرة', long: 'استراحة طويلة' };
const timer = { theme: 'night', face: 'digital', vol: 0.7, mode: 'pomo', phase: 'work', round: 1, taskId: null, customMins: 240, running: false, endAt: 0, left: 0, dur: 0, segStart: 0, worked: 0, started: 0, finished: null };
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
  if (ui.view === 'focus') { render(); $('#fstage').classList.add('finish'); burst($('#f-clock')); } else paintFocus();
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
  const editable = timer.mode !== 'stop' && (locked || timer.mode === 'custom');
  view.innerHTML = `<div class="wrap wide focus-page">
    <section class="fstage" id="fstage" data-theme="${timer.theme}" data-face="${timer.face}">
      <div class="fs-bg"><i></i><i></i><i></i><div class="fs-liquid" id="f-liquid"><svg viewBox="0 0 1200 40" preserveAspectRatio="none"><path d="M0 20C150 0 150 0 300 20S450 40 600 20 750 0 900 20 1050 40 1200 20V40H0Z"/></svg></div></div><div class="fs-wave"></div>
      <div class="fs-top">
        <div class="fs-modes">${[['pomo', 'بومودورو'], ['custom', 'مؤقت'], ['stop', 'ساعة إيقاف']].map(([k, n]) => `<button class="${timer.mode === k ? 'on' : ''}" data-act="focus-mode" data-m="${k}" ${locked ? 'disabled' : ''}>${n}</button>`).join('')}</div>
        <div class="fs-tools">
          <div class="fs-themes">${FTHEMES.map(([k, n]) => `<button class="fs-sw sw-${k} ${timer.theme === k ? 'on' : ''}" data-act="focus-theme" data-t="${k}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
          <input class="fs-vol" id="f-vol" type="range" min="0" max="1" step="0.01" value="${timer.vol}" dir="ltr" aria-label="مستوى الصوت" title="مستوى الصوت" hidden>
          <button class="fs-ic" id="f-sound" data-act="focus-sound" title="صوت هادي للمذاكرة" aria-label="صوت هادي للمذاكرة">${FICON.sound}</button>
          <button class="fs-ic" id="f-full" data-act="focus-full" title="ملء الشاشة (F)" aria-label="ملء الشاشة">${FICON.full}</button>
        </div>
      </div>
      <div class="fs-center">
        <div class="fs-phase" id="f-phase"></div>
        <button class="fs-clock" id="f-clock" data-act="focus-toggle" dir="ltr" aria-label="ابدأ أو أوقف"></button>
        <div class="fs-track" dir="ltr"><i id="f-prog"></i></div>
        <div class="fs-sub"><span id="f-sub"></span><span id="f-end" dir="ltr"></span></div>
      </div>
      <div class="fs-bottom">
        <div class="fs-faces">${FFACES.map(([k, n]) => `<button class="${timer.face === k ? 'on' : ''}" data-act="focus-face" data-f="${k}">${n}</button>`).join('')}</div>
        <div class="f-btns" id="f-btns"></div>
        ${editable ? '<div class="fs-adjust"><button data-act="focus-add" data-m="-5">−٥ د</button><button data-act="focus-add" data-m="5">+٥ د</button></div>' : ''}
        ${timer.mode === 'custom' && !locked ? `<div class="f-presets">${[15, 30, 45, 60, 120, 240].map(m => `<button class="chip-btn ${timer.customMins === m ? 'on' : ''}" data-act="focus-mins" data-m="${m}">${fmtMins(m)}</button>`).join('')}
          <label class="f-custom"><input type="number" id="f-h" min="0" max="23" value="${Math.floor(timer.customMins / 60)}"><span>ساعة</span><input type="number" id="f-m" min="0" max="59" value="${timer.customMins % 60}"><span>دقيقة</span></label></div>` : ''}
        <label class="f-task"><span>المهمة</span><select id="f-task"><option value="">بدون مهمة</option>${open.map(t => `<option value="${t.id}" ${t.id === timer.taskId ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>
      </div>
      <div class="fs-foot"><span>اليوم ${fmtMins(focusMins(s => s.day === td))} تركيز</span><span class="fs-keys">مسافة: ابدأ أو أوقف · F: ملء الشاشة</span><b id="f-now" dir="ltr"></b></div>
    </section>
    <div class="focus-side">
      <section class="card"><h3>اليوم</h3><div class="f-total">${fmtMins(focusMins(s => s.day === td))}</div>
        ${[...byT].sort((a, b) => b[1] - a[1]).map(([id, m]) => `<div class="f-row"><span>${esc(state.tasks.find(t => t.id === id)?.title || state.sessions.find(s => s.taskId === id && s.title)?.title || 'بدون مهمة')}</span><b>${fmtMins(m)}</b></div>`).join('') || '<div class="hint">ما بدأت جلسة اليوم</div>'}</section>
      <section class="card"><h3>آخر ٧ أيام</h3><div class="f-bars">${days.map((d, i) => `<div class="f-bar ${d === td ? 'today' : ''}" title="${fmtMins(tot[i])}"><i style="height:${Math.max(3, tot[i] / max * 100)}%"></i><span>${DOW_SHORT[parseYmd(d).getDay()]}</span></div>`).join('')}</div></section>
      ${timer.mode === 'pomo' ? `<section class="card"><h3>إعدادات بومودورو</h3><div class="f-set-row">${[['work', 'التركيز'], ['short', 'استراحة قصيرة'], ['long', 'استراحة طويلة'], ['every', 'طويلة كل']].map(([k, n]) => `<label>${n}<input type="number" min="1" max="${k === 'every' ? 12 : 180}" data-pomo="${k}" value="${p[k]}"></label>`).join('')}</div></section>` : ''}
    </div></div>`;
  paintFocus();
}
// each digit is its own element, so only the one that changed moves
function paintDigits(el, text) {
  el.classList.toggle('long', text.length > 5);
  if (el.dataset.t === text) return;
  const build = FACE_DIGIT[timer.face] || FACE_DIGIT.digital;
  if (el.children.length !== text.length || [...text].some((ch, i) => (ch === ':') !== el.children[i].classList.contains('sep'))) {
    el.innerHTML = [...text].map(ch => build.make(ch)).join('');
  } else [...text].forEach((ch, i) => { const d = el.children[i]; if (d.dataset.c !== ch) build.set(d, ch); });
  el.dataset.t = text;
}
function paintFace(text, sweep) {
  const el = $('#f-clock'), round = timer.face === 'ring' || timer.face === 'dial';
  if (el.dataset.face !== timer.face) {
    el.dataset.face = timer.face; delete el.dataset.t;
    el.innerHTML = timer.face === 'ring' ? '<svg class="fc-ring" viewBox="0 0 260 260"><circle class="bg" cx="130" cy="130" r="122"/><circle class="on" cx="130" cy="130" r="122" pathLength="1000"/></svg><span class="fc-digits"></span>'
      : timer.face === 'dial' ? '<span class="fc-pie"></span><span class="fc-hub"></span><span class="fc-digits"></span>' : '';
  }
  paintDigits(round ? el.querySelector('.fc-digits') : el, text);
  $('#fstage').style.setProperty('--sweep', sweep);
  el.querySelector('.fc-ring .on')?.setAttribute('stroke-dasharray', `${sweep * 1000} 1000`);
  $('#f-liquid').style.height = `${sweep * 100}%`;
}
let pill = null;
function paintFocus() {
  const active = timerActive(), left = timerLeft(), clock = timer.mode === 'stop' ? fmtClock(workedNow()) : fmtClock(left);
  const task = state?.tasks?.find(t => t.id === timer.taskId);
  const stage = $('#fstage');
  if (stage && ui.view === 'focus') {
    const pct = timer.mode === 'stop' ? 1 : (timer.dur ? Math.max(0, left / timer.dur) : 1);
    stage.classList.toggle('rest', !isWork()); stage.classList.toggle('going', timer.running); stage.classList.toggle('paused', active && !timer.running);
    $('#f-prog').style.transform = `scaleX(${pct})`;
    if (inFs() && !document.body.classList.contains('f-idle')) stage.style.setProperty('--bot', `${$('.fs-bottom').offsetHeight + $('.fs-foot').offsetHeight + 34}px`);
    paintFace(clock, timer.mode === 'stop' ? (workedNow() / 60000) % 1 : pct);
    $('#f-phase').textContent = timer.mode === 'pomo' ? `${PHASES[timer.phase]} · الجولة ${timer.round} من ${pomo().every}` : timer.mode === 'stop' ? 'ساعة إيقاف' : 'مؤقت';
    $('#f-sub').textContent = task ? task.title : '';
    $('#f-end').textContent = timer.running && timer.mode !== 'stop' ? `← ${dayTime(timer.endAt)}` : '';
    $('#f-now').textContent = dayTime(Date.now());
    $('#f-sound').classList.toggle('on', !!noise); $('#f-vol').hidden = !noise;
    $('#f-full').innerHTML = document.body.classList.contains('focus-fs') ? FICON.exit : FICON.full;
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
const FFACES = [['digital', 'رقمي'], ['flip', 'قلّاب'], ['ring', 'دائرة'], ['dial', 'قرص'], ['led', 'ليد'], ['wave', 'موج']];
const LED_SEGS = { a: '12,2 48,2 42,9 18,9', b: '51,4 58,10 58,44 53,49 46,44 46,10', c: '53,51 58,56 58,90 51,96 46,90 46,56', d: '18,91 42,91 48,98 12,98', e: '7,51 2,56 2,90 9,96 14,90 14,56', f: '9,4 2,10 2,44 7,49 14,44 14,10', g: '10,50 16,46 44,46 50,50 44,54 16,54' };
const LED_ON = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
const sepHtml = (inner = ':') => `<span class="sep" data-c=":">${inner}</span>`;
const FACE_DIGIT = {
  digital: {
    make: ch => ch === ':' ? sepHtml() : `<span data-c="${ch}">${ch}</span>`,
    set(d, ch) { d.dataset.c = ch; d.textContent = ch; d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); },
  },
  // a card has the new top and the old bottom showing, with two flaps turning between them
  flip: {
    make: ch => ch === ':' ? sepHtml('<i></i><i></i>') : `<span class="fl" data-c="${ch}"><span class="h top"><b>${ch}</b></span><span class="h bot"><b>${ch}</b></span><span class="h top ft"><b>${ch}</b></span><span class="h bot fb"><b>${ch}</b></span></span>`,
    set(d, ch) {
      const old = d.dataset.c, [top, bot, ft, fb] = d.querySelectorAll('b');
      d.dataset.c = ch; top.textContent = ch; bot.textContent = old; ft.textContent = old; fb.textContent = ch;
      d.classList.remove('go'); void d.offsetWidth; d.classList.add('go');
    },
  },
  led: {
    make: ch => ch === ':' ? sepHtml('<svg viewBox="0 0 20 100"><circle cx="10" cy="32" r="6"/><circle cx="10" cy="68" r="6"/></svg>')
      : `<svg class="led" data-c="${ch}" viewBox="0 0 60 100">${Object.entries(LED_SEGS).map(([k, pts]) => `<polygon points="${pts}" class="${LED_ON[+ch].includes(k) ? 'on' : ''}" data-s="${k}"/>`).join('')}</svg>`,
    set(d, ch) { d.dataset.c = ch; d.querySelectorAll('polygon').forEach(g => g.classList.toggle('on', LED_ON[+ch].includes(g.dataset.s))); },
  },
};
const FTHEMES = [['night', 'ليل'], ['sunset', 'غروب'], ['forest', 'غابة'], ['ocean', 'بحر'], ['black', 'أسود']];
const fic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const FICON = {
  full: fic('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  exit: fic('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  sound: fic('<path d="M3 10v4M7.5 6v12M12 3v18M16.5 7v10M21 10v4"/>'),
};
const dayTime = ms => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/* ---------- full screen: the real thing where the browser allows it, and always covering the whole app ---------- */
let wakeLock = null, nativeFs = false, idleTimer = 0, wokeByTap = false;
const fsNow = () => document.fullscreenElement || document.webkitFullscreenElement;
const inFs = () => document.body.classList.contains('focus-fs');
async function keepAwake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed right now */ } }
function enterFs() {
  document.body.classList.add('focus-fs');
  const el = document.documentElement;
  try { (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {}); } catch { /* the overlay still covers the app */ }
  keepAwake(); wake(); paintFocus();
}
function exitFs() {
  document.body.classList.remove('focus-fs', 'f-idle'); clearTimeout(idleTimer); nativeFs = false;
  if (fsNow()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  wakeLock?.release?.().catch?.(() => {}); wakeLock = null;
  paintFocus();
}
// the controls step aside while the clock runs, and come back on any movement
function wake() {
  document.body.classList.remove('f-idle'); clearTimeout(idleTimer);
  if (inFs()) idleTimer = setTimeout(() => { if (inFs() && timer.running) document.body.classList.add('f-idle'); }, 3000);
}
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => {
  if (fsNow()) nativeFs = true; else if (nativeFs && inFs()) exitFs();
});
document.addEventListener('visibilitychange', () => { if (inFs() && document.visibilityState === 'visible') keepAwake(); });
document.addEventListener('mousemove', () => { if (inFs()) wake(); });
// a tap on a sleeping screen only brings the controls back; it doesn't press what's under it
document.addEventListener('pointerdown', () => { if (inFs()) { wokeByTap = document.body.classList.contains('f-idle'); wake(); } }, true);
document.addEventListener('click', e => { if (wokeByTap) { wokeByTap = false; e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener('keydown', e => {
  if (typeof ui === 'undefined' || ui.view !== 'focus' || e.metaKey || e.ctrlKey || e.target.matches?.('input, select, textarea, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
  if (e.code === 'Space') { e.preventDefault(); A['focus-toggle'](); }
  else if (e.key === 'f' || e.key === 'F' || e.key === 'ف') A['focus-full']();
  else if (e.key === 'Escape' && inFs()) exitFs();
  else if (e.key === 'ArrowUp' && $('.fs-adjust')) { e.preventDefault(); addTime(5); }
  else if (e.key === 'ArrowDown' && $('.fs-adjust')) { e.preventDefault(); addTime(-5); }
  else return;
  wake();
});
function addTime(mins) {
  const ms = mins * 60000;
  if (!timerActive()) { timer.customMins = Math.max(1, timer.customMins + mins); resetClock(); return render(); }
  if (timer.running) { timer.endAt = Math.max(Date.now() + 60000, timer.endAt + ms); timer.dur = Math.max(timer.dur, timer.endAt - Date.now()); }
  else { timer.left = Math.max(60000, timer.left + ms); timer.dur = Math.max(timer.dur, timer.left); }
  keepTimer(); paintFocus();
}
// soft brown noise for studying, made on the spot with no audio files
let noise = null;
function toggleNoise() {
  if (noise) { const n = noise; noise = null; n.gain.gain.setTargetAtTime(0, n.ac.currentTime, 0.2); setTimeout(() => n.ac.close(), 800); return paintFocus(); }
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), d = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < d.length; i++) { v = (v + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = v * 3.5; }
    const src = ac.createBufferSource(), gain = ac.createGain();
    src.buffer = buf; src.loop = true; gain.gain.value = 0; src.connect(gain); gain.connect(ac.destination); src.start();
    gain.gain.setTargetAtTime(timer.vol ** 2, ac.currentTime, 0.5); // ears hear loudness on a curve
    noise = { ac, gain };
  } catch { toast('الصوت مو متاح هنا'); }
  paintFocus();
}

document.addEventListener('input', e => {
  if (e.target.id !== 'f-vol') return;
  timer.vol = +e.target.value; keepTimer();
  if (noise) noise.gain.gain.setTargetAtTime(timer.vol ** 2, noise.ac.currentTime, 0.05);
});
setInterval(() => {
  if (typeof state === 'undefined' || !state) return;
  if (ui.view !== 'focus' && inFs()) exitFs();
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
  'focus-toggle': () => { if (timer.running) pauseClock(); else startClock(); wake(); },
  'focus-full': () => { if (inFs()) exitFs(); else enterFs(); },
  'focus-theme': a => { timer.theme = a.dataset.t; keepTimer(); render(); },
  'focus-face': a => { timer.face = a.dataset.f; keepTimer(); render(); },
  'focus-sound': () => toggleNoise(),
  'focus-add': a => addTime(+a.dataset.m),
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
