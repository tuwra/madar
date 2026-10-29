'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage, screen, safeStorage } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const IS_MAC = process.platform === 'darwin', IS_WIN = process.platform === 'win32';
const updater = require('./updater');

app.setName('Madar');

/* ---------- where the data lives ---------- */
// config.json (always in userData) remembers the data folder, which can be
// inside Google Drive / iCloud / OneDrive so everything syncs on its own.
const configFile = () => path.join(app.getPath('userData'), 'config.json');
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configFile(), 'utf8')); } catch { return {}; }
}
function writeConfig(c) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(c, null, 2));
}
const defaultDataDir = () => path.join(app.getPath('userData'), 'data');
function dataDir() {
  const d = readConfig().dataDir || defaultDataDir();
  fs.mkdirSync(path.join(d, 'files'), { recursive: true });
  return d;
}
const stateFile = () => path.join(dataDir(), 'state.json');
// blob keys look like "blob:abc" or "pdf:abc"; keep them filename-safe
const blobPath = key => path.join(dataDir(), 'files', String(key).replace(/[^a-zA-Z0-9_-]/g, '_'));

function writeAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function cloudFolders() {
  const out = [];
  const cs = path.join(os.homedir(), 'Library', 'CloudStorage');
  try {
    for (const name of fs.readdirSync(cs)) {
      const full = path.join(cs, name);
      let kind = 'other';
      if (/^GoogleDrive/i.test(name)) kind = 'google';
      else if (/^OneDrive/i.test(name)) kind = 'onedrive';
      else if (/^Dropbox/i.test(name)) kind = 'dropbox';
      // Google Drive mounts "My Drive" (or the localized name) inside the account folder
      let target = full;
      if (kind === 'google') {
        try {
          const inner = fs.readdirSync(full).find(n => /^(My Drive|محرّ?ك|ملفاتي|Mi unidad)/i.test(n)) || fs.readdirSync(full).find(n => !n.startsWith('.'));
          if (inner) target = path.join(full, inner);
        } catch { /* ignore */ }
      }
      out.push({ kind, name, path: target });
    }
  } catch { /* no CloudStorage folder */ }
  if (IS_WIN) {
    for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
      for (const inner of ['My Drive', 'محرّكي', 'ملفاتي', 'Mi unidad']) {
        const p = `${letter}:\\${inner}`;
        try { if (fs.existsSync(p)) { out.push({ kind: 'google', name: 'Google Drive', path: p }); break; } } catch { /* no such drive */ }
      }
    }
    const legacy = path.join(os.homedir(), 'Google Drive');
    if (fs.existsSync(legacy) && !out.some(c => c.kind === 'google')) out.push({ kind: 'google', name: 'Google Drive', path: legacy });
    if (process.env.OneDrive && fs.existsSync(process.env.OneDrive)) out.push({ kind: 'onedrive', name: 'OneDrive', path: process.env.OneDrive });
    for (const [kind, dir] of [['icloud', 'iCloudDrive'], ['dropbox', 'Dropbox']]) { const p = path.join(os.homedir(), dir); if (fs.existsSync(p)) out.push({ kind, name: dir, path: p }); }
    return out;
  }
  const icloud = path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs');
  if (fs.existsSync(icloud)) out.push({ kind: 'icloud', name: 'iCloud Drive', path: icloud });
  return out;
}

/* ---------- ipc ---------- */
ipcMain.handle('state:load', () => {
  try { return fs.readFileSync(stateFile(), 'utf8'); } catch { return null; }
});
ipcMain.handle('state:save', (_e, json) => { writeAtomic(stateFile(), json); return fs.statSync(stateFile()).mtimeMs; });
ipcMain.handle('state:mtime', () => { try { return fs.statSync(stateFile()).mtimeMs; } catch { return 0; } });
ipcMain.handle('blob:get', (_e, key) => {
  try {
    const buf = fs.readFileSync(blobPath(key));
    const meta = JSON.parse(fs.readFileSync(blobPath(key) + '.json', 'utf8'));
    return { bytes: buf, type: meta.type || '' };
  } catch { return null; }
});
ipcMain.handle('blob:set', (_e, key, bytes, type) => {
  writeAtomic(blobPath(key), Buffer.from(bytes));
  fs.writeFileSync(blobPath(key) + '.json', JSON.stringify({ type }));
  return true;
});
ipcMain.handle('blob:del', (_e, key) => {
  for (const f of [blobPath(key), blobPath(key) + '.json']) { try { fs.unlinkSync(f); } catch { /* gone */ } }
  return true;
});

/* ---------- Google sign-in: a one-shot local server catches the browser's redirect ---------- */
let oauthWait = null;
ipcMain.handle('oauth:listen', () => new Promise((resolve, reject) => {
  let done;
  oauthWait = new Promise(r => { done = r; });
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const code = u.searchParams.get('code'), error = u.searchParams.get('error');
    if (!code && !error) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html dir="rtl"><body style="font-family:-apple-system,system-ui;text-align:center;padding:80px;background:#f7f7f5;color:#1f2328"><h2>${code ? 'تم تسجيل الدخول ✓' : 'ما تم تسجيل الدخول'}</h2><p>ارجع لتطبيق مدار، وتقدر تسكر هذي الصفحة.</p></body></html>`);
    done({ code, error }); server.close(); showMain();
  });
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  setTimeout(() => { done({ error: 'timeout' }); server.close(); }, 5 * 60 * 1000);
}));
ipcMain.handle('oauth:wait', () => oauthWait);
const secretsFile = () => path.join(app.getPath('userData'), 'secrets.json');
ipcMain.handle('secret:get', (_e, key) => {
  try {
    const all = JSON.parse(fs.readFileSync(secretsFile(), 'utf8'));
    if (!all[key]) return null;
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(all[key], 'base64')) : Buffer.from(all[key], 'base64').toString();
  } catch { return null; }
});
ipcMain.handle('secret:set', (_e, key, value) => {
  let all = {}; try { all = JSON.parse(fs.readFileSync(secretsFile(), 'utf8')); } catch { /* new */ }
  if (!value) delete all[key];
  else all[key] = (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(value) : Buffer.from(value)).toString('base64');
  fs.writeFileSync(secretsFile(), JSON.stringify(all), { mode: 0o600 });
  return true;
});
ipcMain.handle('folder:info', () => ({ dataDir: dataDir(), isDefault: !readConfig().dataDir, clouds: cloudFolders() }));
ipcMain.handle('folder:choose', async (e, suggested) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  let dir = suggested;
  if (!dir) {
    const r = await dialog.showOpenDialog(win, { title: 'اختر مجلد حفظ بيانات مدار', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    dir = r.filePaths[0];
  }
  if (path.basename(dir) !== 'Madar') dir = path.join(dir, 'Madar');
  const old = dataDir();
  if (path.resolve(old) === path.resolve(dir)) return { dataDir: dir, reload: false };
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  const hasData = fs.existsSync(path.join(dir, 'state.json'));
  let useExisting = false;
  if (hasData) {
    const r = await dialog.showMessageBox(win, {
      type: 'question', buttons: ['استخدم البيانات اللي في المجلد', 'استبدلها ببيانات هذا الجهاز', 'إلغاء'], cancelId: 2, defaultId: 0,
      message: 'هذا المجلد فيه بيانات مدار من قبل', detail: 'غالبًا من جهاز ثاني. تبي تفتح البيانات اللي فيه، ولا تستبدلها بالبيانات اللي على هذا الجهاز؟',
    });
    if (r.response === 2) return null;
    useExisting = r.response === 0;
  }
  if (!useExisting) {
    // copy this device's data into the new folder
    if (fs.existsSync(path.join(old, 'state.json'))) fs.copyFileSync(path.join(old, 'state.json'), path.join(dir, 'state.json'));
    try { for (const f of fs.readdirSync(path.join(old, 'files'))) fs.copyFileSync(path.join(old, 'files', f), path.join(dir, 'files', f)); } catch { /* none */ }
  }
  writeConfig({ ...readConfig(), dataDir: dir });
  return { dataDir: dir, reload: true };
});
ipcMain.handle('folder:reveal', () => shell.openPath(dataDir()));

ipcMain.handle('file:pick', async (e, opts = {}) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const google = cloudFolders().find(c => c.kind === 'google');
  const r = await dialog.showOpenDialog(win, {
    title: opts.title, defaultPath: opts.fromDrive && google ? google.path : undefined,
    properties: ['openFile', ...(opts.multiple ? ['multiSelections'] : [])], filters: opts.filters,
  });
  if (r.canceled) return [];
  return r.filePaths.map(p => ({ path: p, name: path.basename(p), size: fs.statSync(p).size, bytes: opts.readBytes === false ? null : fs.readFileSync(p) }));
});
ipcMain.handle('file:save', async (e, { name, bytes, filters }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('downloads'), name), filters });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(bytes));
  return r.filePath;
});
ipcMain.handle('file:saveToDrive', async (_e, { name, bytes }) => {
  const google = cloudFolders().find(c => c.kind === 'google');
  if (!google) return null;
  const dir = path.join(google.path, 'Madar', 'Exports');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, Buffer.from(bytes));
  return p;
});
ipcMain.handle('file:open', (_e, p) => shell.openPath(p));
ipcMain.handle('file:reveal', (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('file:exists', (_e, p) => fs.existsSync(p));
ipcMain.handle('ask', async (e, { message, detail, buttons }) => {
  const r = await dialog.showMessageBox(BrowserWindow.fromWebContents(e.sender), { type: 'question', message, detail, buttons, cancelId: buttons.length - 1, defaultId: 0 });
  return r.response;
});

/* ---------- window ---------- */
let mainWin = null, tray = null, trayWin = null, quitting = false, trayReady = false;
function createWindow() {
  const win = mainWin = new BrowserWindow({
    width: 1320, height: 860, minWidth: 380, minHeight: 520,
    title: 'مدار', backgroundColor: '#f7f7f5', show: false, autoHideMenuBar: IS_WIN,
    icon: IS_WIN ? path.join(__dirname, 'icon.png') : undefined,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.once('ready-to-show', () => { if (!process.env.MADAR_HIDDEN) win.show(); });
  // closing the window keeps Madar running in the menu bar, like other Mac apps
  // closing the window keeps Madar running next to the clock (menu bar on Mac, tray on Windows)
  win.on('close', e => { if (!quitting && tray) { e.preventDefault(); win.hide(); } });
  win.on('closed', () => { if (mainWin === win) { mainWin = null; trayReady = false; } });
  win.webContents.on('did-start-loading', () => { trayReady = false; });
  // links open in the default browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  // MADAR_SELFTEST=1 runs a quick smoke test of storage and the main views, then quits
  if (process.env.MADAR_SELFTEST) {
    win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) console.log('[renderer]', msg); });
    win.webContents.once('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 1500));
      const result = await win.webContents.executeJavaScript(`(async () => {
        const out = { desktop: !!window.madar, tasks: state.tasks.length };
        for (const v of ['today', 'tasks', 'calendar', 'notes', 'ink']) { go(v); out[v] = view.innerHTML.length > 200; }
        state.tasks.push(newTask('selftest', 'inbox')); flush(); await new Promise(r => setTimeout(r, 300));
        const saved = JSON.parse(await madar.loadState()); out.saved = saved.tasks.some(t => t.title === 'selftest');
        state.tasks = state.tasks.filter(t => t.title !== 'selftest'); flush();
        const key = await putBlob(new Blob(['hello'], { type: 'text/plain' })); out.blob = (await (await store.getBlob(key)).text()) === 'hello'; await store.delBlob(key);
        out.libs = { pdf: !!window.pdfjsLib, hljs: !!window.hljs, katex: !!window.katex, jspdf: !!window.jspdf };
        out.font = document.fonts.check('16px "IBM Plex Sans Arabic"');
        return out;
      })()`);
      console.log('SELFTEST', JSON.stringify(result));
      if (process.env.MADAR_SELFTEST_OUT) fs.writeFileSync(process.env.MADAR_SELFTEST_OUT, JSON.stringify({ ...result, tray: !!tray, platform: process.platform }));
      if (trayWin && process.env.MADAR_SHOT) {
        const sum = await askMain('window.trayApi.summary()');
        console.log('TRAY', JSON.stringify({ title: tray.getTitle(), open: sum.open, tasks: sum.tasks.length }));
        trayWin.setPosition(200, 60); trayWin.showInactive();
        for (const tab of ['today', 'cal', 'notes', 'ink']) {
          await trayWin.webContents.executeJavaScript(`setTab(${JSON.stringify(tab)})`);
          await new Promise(r => setTimeout(r, 900));
          fs.writeFileSync(process.env.MADAR_SHOT.replace('.png', `-${tab}.png`), (await trayWin.webContents.capturePage()).toPNG());
        }
      }
      quitting = true; app.quit(); setTimeout(() => app.exit(0), 1500);
    });
  }
}

/* ---------- menu bar ---------- */
const TRAY_W = 360, TRAY_H = 540;
async function askMain(code) {
  if (!mainWin) createWindow();
  const wc = mainWin.webContents;
  if (wc.isLoading()) await new Promise(r => wc.once('did-finish-load', r));
  // `state` is a top-level let in the app, so it is not a property of window
  if (!trayReady) {
    for (let i = 0; i < 50 && !trayReady; i++) {
      trayReady = await wc.executeJavaScript("!!(window.trayApi && typeof state !== 'undefined' && state)");
      if (!trayReady) await new Promise(r => setTimeout(r, 100));
    }
  }
  return wc.executeJavaScript(code);
}
async function updateTrayTitle() {
  if (!tray) return;
  try { const s = await askMain('window.trayApi.summary()'); if (IS_MAC) tray.setTitle(s.open ? ` ${s.open}` : '', { fontType: 'monospacedDigit' }); tray.setToolTip(s.open ? `مدار · باقي ${s.open} من مهام اليوم` : 'مدار'); } catch { /* window not ready */ }
}
function createTray() {
  const icon = IS_MAC ? nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png')) : nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 32, height: 32 });
  if (IS_MAC) icon.setTemplateImage(true);
  tray = new Tray(icon);
  trayWin = new BrowserWindow({
    width: TRAY_W, height: TRAY_H, show: false, frame: false, resizable: false, movable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, transparent: true, vibrancy: 'popover', visualEffectState: 'active', roundedCorners: true,
    webPreferences: { preload: path.join(__dirname, 'tray-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  trayWin.loadFile(path.join(__dirname, '..', 'src', 'tray.html'));
  if (process.env.MADAR_SELFTEST) trayWin.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) console.log('[tray]', msg); });
  // clicking the icon while the window is open blurs it first; remember when, so that click doesn't reopen it
  let lastHide = 0;
  trayWin.on('blur', () => { trayWin.hide(); lastHide = Date.now(); });
  const toggle = () => {
    if (trayWin.isVisible()) return trayWin.hide();
    if (Date.now() - lastHide < 250) return;
    const b = tray.getBounds(), area = screen.getDisplayMatching(b).workArea;
    const x = Math.round(Math.min(area.x + area.width - TRAY_W - 8, Math.max(area.x + 8, b.x + b.width / 2 - TRAY_W / 2)));
    const below = b.y < area.y + area.height / 2;
    const y = below ? b.y + b.height + 4 : Math.max(area.y + 8, area.y + area.height - TRAY_H - 8);
    trayWin.setPosition(x, Math.round(y), false);
    trayWin.show(); trayWin.focus();
    trayWin.webContents.send('tray:refresh');
  };
  tray.on('click', toggle);
  tray.on('right-click', () => tray.popUpContextMenu(Menu.buildFromTemplate([
    { label: 'فتح مدار', click: () => showMain() },
    { label: 'التحقق من التحديثات…', click: () => { showMain(); updater.check(true); } },
    { type: 'separator' },
    { label: 'إنهاء مدار', click: () => { quitting = true; app.quit(); } },
  ])));
  updateTrayTitle();
  // the day changes at midnight: refresh the count every few minutes
  setInterval(updateTrayTitle, 5 * 60 * 1000);
}
function showMain(view) {
  if (!mainWin) createWindow();
  mainWin.show(); mainWin.focus();
  if (view) askMain(`window.trayApi.open(${JSON.stringify(view)})`);
}
ipcMain.handle('tray:summary', () => askMain('window.trayApi.summary()'));
ipcMain.handle('tray:toggle', (_e, id) => askMain(`window.trayApi.toggle(${JSON.stringify(String(id))})`));
ipcMain.handle('tray:add', (_e, text) => askMain(`window.trayApi.add(${JSON.stringify(String(text))})`));
ipcMain.handle('tray:open', (_e, view) => { trayWin?.hide(); showMain(String(view)); });
const TRAY_CALLS = ['summary', 'toggle', 'add', 'habitTap', 'month', 'day', 'addOn', 'toggleOn', 'pages', 'page', 'toggleBlock', 'appendToPage', 'newNote'];
const TRAY_OPENS = ['openPage', 'openNotebook'];
ipcMain.handle('tray:call', (_e, name, args = []) => {
  if (!TRAY_CALLS.includes(name) && name !== 'notebooks') throw new Error('not allowed');
  return askMain(`window.trayApi[${JSON.stringify(name)}](...${JSON.stringify(args.map(String))})`);
});
ipcMain.handle('tray:openItem', (_e, name, id) => {
  if (!TRAY_OPENS.includes(name)) throw new Error('not allowed');
  trayWin?.hide(); showMain();
  return askMain(`window.trayApi[${JSON.stringify(name)}](${JSON.stringify(String(id))})`);
});
ipcMain.handle('tray:hide', () => trayWin?.hide());
ipcMain.on('state:changed', () => { updateTrayTitle(); if (trayWin?.isVisible()) trayWin.webContents.send('tray:refresh'); });

app.on('before-quit', () => { quitting = true; });
app.on('madar-quit-for-update', () => { quitting = true; });
ipcMain.handle('update:get', () => updater.getState());
ipcMain.handle('update:check', () => updater.check(true));
ipcMain.handle('update:install', () => updater.install());
app.setAboutPanelOptions({
  applicationName: 'مدار', applicationVersion: app.getVersion(),
  copyright: '© 2026 رائد العتيبي (Raeed Alotaibi)', credits: 'صمّمه وطوّره رائد العتيبي', website: 'https://github.com/tuwra/madar',
});
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    IS_MAC ? { label: app.name, submenu: [
      { role: 'about', label: 'عن مدار' },
      { label: 'التحقق من التحديثات…', click: () => { showMain(); updater.check(true); } },
      { type: 'separator' }, { role: 'hide', label: 'إخفاء مدار' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' }, { role: 'quit', label: 'إنهاء مدار' },
    ] } : { label: 'مدار', submenu: [{ label: 'التحقق من التحديثات…', click: () => updater.check(true) }, { role: 'quit', label: 'إنهاء' }] },
    { role: 'editMenu' },
    { label: 'عرض', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [{ label: 'صفحة المشروع على GitHub', click: () => shell.openExternal('https://github.com/tuwra/madar') }] },
  ]));
  createWindow();
  if (IS_MAC || IS_WIN) createTray();
  // MADAR_UPDATE_TEST installs the first update it finds, to test the whole update path
  updater.start(st => { if (process.env.MADAR_UPDATE_TEST && st.status === 'available') updater.install(); mainWin?.webContents.send('update:state', st); if (st.status === 'ready' || st.status === 'available') tray?.setToolTip(`مدار · تحديث جديد ${st.version}`); });
  app.on('activate', () => showMain());
});
app.on('window-all-closed', () => { if (!tray) app.quit(); });
