'use strict';
/* ---------- storage, Google Drive sync, backup ---------- */

const CLOUD_NAMES = { google: 'قوقل درايف', icloud: 'iCloud Drive', onedrive: 'OneDrive', dropbox: 'Dropbox', other: 'مجلد سحابي' };

async function storageDialog() {
  if (!desktop) return browserBackupDialog();
  const info = await desktop.folderInfo();
  const google = info.clouds.find(c => c.kind === 'google');
  const inCloud = info.clouds.find(c => info.dataDir.startsWith(c.path));
  openDialog(`<h3>الحفظ والمزامنة</h3>
    <div class="store-now ${inCloud ? 'ok' : ''}">
      <b>${inCloud ? `✓ بياناتك تتزامن مع ${CLOUD_NAMES[inCloud.kind]}` : 'بياناتك محفوظة على هذا الماك فقط'}</b>
      <div class="hint" dir="ltr" style="text-align:right">${esc(info.dataDir)}</div>
    </div>
    ${cloudSection()}
    <span class="note">أو احفظ بياناتك في مجلد على هذا الجهاز</span>
    <p class="note">اختر مجلد داخل قوقل درايف، وكل مهامك وملاحظاتك ودفاترك وكتبك تنحفظ فيه وتتزامن لحالها. ثبّت مدار على ماك ثاني واختر نفس المجلد عشان تشوف نفس البيانات.</p>
    ${google ? `<button class="btn primary" value="cloud:${esc(google.path)}">△ احفظ في قوقل درايف</button>`
      : `<div class="store-now"><b>قوقل درايف مو مثبّت على هذا الماك</b><div class="hint">نزّل «Google Drive for desktop» وسجّل دخول، وبعدها ارجع هنا.</div><a class="btn small" href="https://www.google.com/drive/download/" target="_blank" rel="noopener">صفحة التنزيل</a></div>`}
    ${info.clouds.filter(c => c.kind !== 'google').map(c => `<button class="btn" value="cloud:${esc(c.path)}">احفظ في ${CLOUD_NAMES[c.kind]}</button>`).join('')}
    <div class="row wrap"><button class="btn" value="choose">اختيار مجلد آخر…</button><button class="btn" value="reveal">فتح المجلد في Finder</button></div>
    ${desktop.apple ? `<span class="note">التقويم والتذكيرات</span>
    <label class="check-row"><input type="checkbox" id="apple-on" ${appleOn() ? 'checked' : ''}> اعرض مواعيدي ومهامي في تقويم الماك وتذكيراته</label>
    <p class="note">يسوي تقويم وقائمة باسم «مدار»، فتطلع في أي تطبيق يقرأ التقويم مثل Boring Notch. وإذا شيّكت مهمة في التذكيرات تتشيّك هنا. أول مرة يسألك الماك تسمح لمدار.</p>` : ''}
    <span class="note">نسخة احتياطية</span>
    <div class="row wrap"><button class="btn" value="export">تصدير نسخة (JSON)</button><button class="btn" value="import">استرجاع من نسخة</button></div>
    <div class="row wrap" style="justify-content:center"><button class="btn small" data-act="update-check" type="button">التحقق من التحديثات</button></div>
    <p class="note" style="text-align:center">مدار · صمّمه وطوّره رائد العتيبي · مفتوح المصدر</p>
    <div class="dlg-actions"><span class="grow"></span><button class="btn" value="cancel">إغلاق</button></div>`, async (fd, v) => {
    if (v.startsWith('cloud:') || v === 'choose') {
      flush();
      await store.saveState(state);
      const r = await desktop.chooseFolder(v === 'choose' ? null : v.slice(6));
      if (r?.reload) location.reload();
      return;
    }
    if (v === 'reveal') return void desktop.revealFolder();
    if (v === 'export') {
      const p = await desktop.saveFile({ name: `madar-backup-${todayStr()}.json`, bytes: new TextEncoder().encode(JSON.stringify(state)), filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (p) toast('انحفظت النسخة. الصور والملفات والكتب موجودة في مجلد البيانات.');
      return;
    }
    if (v === 'import') {
      const [f] = await desktop.pickFile({ title: 'اختر نسخة مدار الاحتياطية', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (f) restoreFrom(new TextDecoder().decode(f.bytes));
    }
  });
}
function browserBackupDialog() {
  openDialog(`<h3>النسخة الاحتياطية</h3>
    ${cloudSection()}
    <p class="note">بياناتك محفوظة على هذا الجهاز. وتقدر كمان تاخذ نسخة احتياطية:</p>
    <button class="btn primary" value="export">تنزيل نسخة</button>
    <label class="btn" style="text-align:center;cursor:pointer">استرجاع من ملف<input type="file" accept=".json,application/json" id="restore-file" hidden></label>
    <div class="dlg-actions"><span class="grow"></span><button class="btn" value="cancel">إغلاق</button></div>`, (fd, v) => {
    if (v !== 'export') return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: 'application/json' }));
    a.download = `madar-backup-${todayStr()}.json`; a.click();
  });
  $('#restore-file').addEventListener('change', async e => { const f = e.target.files[0]; if (f) { dlg.close(); restoreFrom(await f.text()); } });
}
function restoreFrom(text) {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data.tasks) || !Array.isArray(data.pages) || !Array.isArray(data.notebooks)) throw new Error('bad');
    setTimeout(() => ask('الاسترجاع بيستبدل كل بياناتك الحالية بهذي النسخة. تكمل؟', 'استرجاع', () => { state = migrate(data); flush(); render(); }));
  } catch { setTimeout(() => ask('الملف هذا مو نسخة احتياطية من مدار.', null)); }
}
A.backup = () => storageDialog();

// another Mac (through Drive) may have changed the data while this window was in the background
window.addEventListener('focus', async () => {
  if (!desktop || saveTimer || !store.mtime) return;
  const m = await desktop.stateMtime();
  if (m <= store.mtime + 500) return;
  const json = await desktop.loadState();
  if (!json) return;
  store.mtime = m;
  state = migrate(JSON.parse(json));
  if (!(ui.view === 'notes' && document.activeElement?.isContentEditable)) render();
  toast('تحدّثت البيانات من جهازك الثاني');
});

/* ---------- app updates ---------- */
const upd = { st: null, dismissed: null };
function updateBar() {
  const st = upd.st;
  let bar = $('#update-bar');
  const show = st && ['available', 'downloading', 'installing', 'ready'].includes(st.status) && upd.dismissed !== st.version;
  if (!show) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'update-bar'; document.body.appendChild(bar); requestAnimationFrame(() => bar.classList.add('on')); }
  const busy = st.status === 'downloading' || st.status === 'installing';
  bar.innerHTML = `
    <div class="ub-icon">${busy ? '<span class="spin"></span>' : '✨'}</div>
    <div class="ub-text">
      <b>${st.status === 'installing' ? 'جاري التثبيت… مدار بيقفل ويرجع لحاله' : st.status === 'downloading' ? `جاري تنزيل التحديث ${esc(st.version || '')}…` : `تحديث جديد: مدار ${esc(st.version)}`}</b>
      ${busy ? `<div class="ub-prog"><i style="width:${st.progress || 0}%"></i></div>` : `<small>${esc((st.notes || [])[0] || 'فيه تحسينات وإصلاحات جديدة')}${st.error ? ` · ما زبط: ${esc(st.error)}` : ''}</small>`}
    </div>
    ${busy ? '' : `<button class="btn primary small" data-act="update-now">حدّث الحين</button><button class="btn ghost small" data-act="update-later">لاحقًا</button>`}`;
}
if (desktop?.update) {
  desktop.update.on(st => {
    const before = upd.st?.status;
    upd.st = st; updateBar();
    if (st.manual && st.status === 'latest' && before === 'checking') toast(`عندك آخر إصدار (${st.version}) ✓`);
    if (st.manual && st.status === 'error' && before === 'checking') toast('ما قدرت أتأكد من التحديثات. تأكد من الإنترنت وجرّب مرة ثانية.', 4000);
    if (st.manual && st.status === 'checking') toast('أتأكد من التحديثات…', 1500);
  });
  desktop.update.get().then(st => { upd.st = st; updateBar(); });
}
A['update-now'] = () => {
  flush(); // write everything to disk before the app closes
  if (upd.st?.status === 'ready' || upd.st?.status === 'available') { upd.st = { ...upd.st, status: upd.st.status === 'ready' ? 'installing' : 'downloading', progress: 0 }; updateBar(); }
  setTimeout(() => desktop.update.install(), 150);
};
A['update-later'] = () => { upd.dismissed = upd.st?.version; updateBar(); };
A['update-check'] = () => desktop?.update?.check();

/* ---------- Apple Calendar and Reminders (Mac app only), switched on per device ---------- */
const appleOn = () => { try { return localStorage.getItem('madar-apple') === '1'; } catch { return false; } };
let appleTimer = 0, appleBusy = false;
function appleItems() {
  const td = todayStr(), to = addDays(td, 60), week = curWeek();
  return {
    events: state.events.filter(e => !e.gcal && e.date >= addDays(td, -7) && e.date <= to)
      .map(e => ({ id: e.id, title: e.title, date: e.date, start: e.start, end: e.end })),
    tasks: state.tasks.map(t => (t.week && !t.due && !t.done ? { ...t, due: addDays(week, 6) } : t)) // a week task is due by Saturday
      .filter(t => t.due && t.due >= addDays(td, -30) && t.due <= to && (!t.done || Date.now() - (t.doneAt || 0) < 7 * 864e5))
      .map(t => ({ id: t.id, title: t.title, due: t.due, time: t.time || null, done: !!t.done })),
  };
}
async function appleSync(loud = false) {
  if (!desktop?.apple || !appleOn()) return;
  if (appleBusy) { clearTimeout(appleTimer); appleTimer = setTimeout(appleSync, 5000); return; }
  appleBusy = true;
  try {
    const r = await desktop.apple.sync(appleItems());
    let ticked = 0;
    for (const id of r.done || []) { const t = state.tasks.find(x => x.id === id); if (t && !t.done) { setTaskDone(t, true); ticked++; } }
    if (ticked) { save(); render(); }
    if (loud) toast('✓ مواعيدك ومهامك صارت في تقويم الماك وتذكيراته');
  } catch (err) {
    console.warn('apple sync failed', err);
    if (loud) toast(/-1743|not allowed|Not authorized/i.test(err.message) ? 'الماك ما سمح لمدار. افتح إعدادات النظام ← الخصوصية والأمان ← الأتمتة، وفعّل التقويم والتذكيرات لمدار' : 'ما قدرت أوصل للتقويم والتذكيرات', 8000);
  } finally { appleBusy = false; }
}
window.addEventListener('madar-saved', () => { clearTimeout(appleTimer); appleTimer = setTimeout(appleSync, 4000); });
setInterval(appleSync, 5 * 60000); // also picks up reminders ticked off on the Mac
setTimeout(appleSync, 8000);
document.addEventListener('change', async e => {
  if (e.target.id !== 'apple-on') return;
  try { localStorage.setItem('madar-apple', e.target.checked ? '1' : '0'); } catch { /* private mode */ }
  if (e.target.checked) { toast('يجهّز التقويم والتذكيرات…'); appleSync(true); }
  else { await desktop.apple.clear().catch(() => {}); toast('شلت مواعيد مدار ومهامه من تقويم الماك'); }
});

