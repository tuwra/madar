'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
    title: 'مدار', backgroundColor: '#f7f7f5', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.once('ready-to-show', () => { if (!process.env.MADAR_HIDDEN) win.show(); });
  // closing the window keeps Madar running in the menu bar, like other Mac apps
  win.on('close', e => { if (!quitting && process.platform === 'darwin') { e.preventDefault(); win.hide(); } });
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
  try { const s = await askMain('window.trayApi.summary()'); tray.setTitle(s.open ? ` ${s.open}` : '', { fontType: 'monospacedDigit' }); tray.setToolTip(s.open ? `مدار · باقي ${s.open} من مهام اليوم` : 'مدار'); } catch { /* window not ready */ }
}
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  trayWin = new BrowserWindow({
    width: TRAY_W, height: TRAY_H, show: false, frame: false, resizable: false, movable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, transparent: true, vibrancy: 'popover', visualEffectState: 'active', roundedCorners: true,
    webPreferences: { preload: path.join(__dirname, 'tray-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  trayWin.loadFile(path.join(__dirname, '..', 'src', 'tray.html'));
  if (process.env.MADAR_SELFTEST) trayWin.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) console.log('[tray]', msg); });
  trayWin.on('blur', () => trayWin.hide());
  const toggle = () => {
    if (trayWin.isVisible()) return trayWin.hide();
    const b = tray.getBounds(), area = screen.getDisplayMatching(b).workArea;
    const x = Math.round(Math.min(area.x + area.width - TRAY_W - 8, Math.max(area.x + 8, b.x + b.width / 2 - TRAY_W / 2)));
    trayWin.setPosition(x, Math.round(b.y + b.height + 4), false);
    trayWin.show(); trayWin.focus();
    trayWin.webContents.send('tray:refresh');
  };
  tray.on('click', toggle);
  tray.on('right-click', () => tray.popUpContextMenu(Menu.buildFromTemplate([
    { label: 'فتح مدار', click: () => showMain() },
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
const TRAY_CALLS = ['summary', 'toggle', 'add', 'month', 'day', 'addOn', 'toggleOn', 'pages', 'page', 'toggleBlock', 'appendToPage', 'newNote'];
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
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { label: 'عرض', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [{ label: 'صفحة المشروع على GitHub', click: () => shell.openExternal('https://github.com/tuwra/madar') }] },
  ]));
  createWindow();
  if (process.platform === 'darwin') createTray();
  app.on('activate', () => showMain());
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
