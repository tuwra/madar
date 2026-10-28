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
    <p class="note">اختر مجلد داخل قوقل درايف، وكل مهامك وملاحظاتك ودفاترك وكتبك تنحفظ فيه وتتزامن لحالها. ثبّت مدار على ماك ثاني واختر نفس المجلد عشان تشوف نفس البيانات.</p>
    ${google ? `<button class="btn primary" value="cloud:${esc(google.path)}">△ احفظ في قوقل درايف</button>`
      : `<div class="store-now"><b>قوقل درايف مو مثبّت على هذا الماك</b><div class="hint">نزّل «Google Drive for desktop» وسجّل دخول، وبعدها ارجع هنا.</div><a class="btn small" href="https://www.google.com/drive/download/" target="_blank" rel="noopener">صفحة التنزيل</a></div>`}
    ${info.clouds.filter(c => c.kind !== 'google').map(c => `<button class="btn" value="cloud:${esc(c.path)}">احفظ في ${CLOUD_NAMES[c.kind]}</button>`).join('')}
    <div class="row wrap"><button class="btn" value="choose">اختيار مجلد آخر…</button><button class="btn" value="reveal">فتح المجلد في Finder</button></div>
    <span class="note">نسخة احتياطية</span>
    <div class="row wrap"><button class="btn" value="export">تصدير نسخة (JSON)</button><button class="btn" value="import">استرجاع من نسخة</button></div>
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
    <p class="note">في المتصفح بياناتك محفوظة في هذا المتصفح فقط. نزّل تطبيق الماك عشان تحفظها في قوقل درايف.</p>
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
