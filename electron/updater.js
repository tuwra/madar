'use strict';
/* ---------- updates from GitHub Releases ----------
 * Windows: electron-updater downloads the new installer in the background, then
 *          installs it silently and reopens the app when the user taps "update now".
 * Mac:     the app is not signed by Apple, so Squirrel.Mac can't be used. Instead we
 *          read the latest release, download its .dmg, copy the new app over this one
 *          from a small script that runs after we quit, and reopen it.
 */
const { app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');

const REPO = 'tuwra/madar';
const EVERY = 4 * 60 * 60 * 1000;
let send = () => {}, state = { status: 'idle' }, timer = null, winUpdater = null;

const currentVersion = () => process.env.MADAR_FAKE_VERSION || app.getVersion();
function newer(a, b) { // is version a newer than b?
  const pa = String(a).replace(/^v/, '').split('.').map(Number), pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}
function set(patch) { state = { ...state, ...patch }; send(state); }

/* ---------- Mac ---------- */
async function latestRelease() {
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Madar' } });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return res.json();
}
async function checkMac(manual) {
  try {
    set({ status: 'checking', manual });
    const rel = await latestRelease();
    const version = rel.tag_name.replace(/^v/, '');
    const asset = rel.assets.find(a => /arm64\.dmg$/.test(a.name)) || rel.assets.find(a => /\.dmg$/.test(a.name));
    if (!newer(version, currentVersion()) || !asset) return set({ status: 'latest', version: currentVersion(), manual });
    set({ status: 'available', version, notes: (rel.body || '').split('\n').filter(l => l.startsWith('- ')).slice(0, 4).map(l => l.slice(2).replace(/\*\*/g, '')), asset: { url: asset.browser_download_url, size: asset.size }, manual });
  } catch (e) { set({ status: 'error', error: e.message, manual }); }
}
const appBundle = () => process.env.MADAR_UPDATE_DEST || path.resolve(app.getAppPath(), '..', '..', '..'); // …/Madar.app
async function installMac() {
  if (state.status !== 'available' || !state.asset) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'madar-update-'));
  const dmg = path.join(dir, 'Madar.dmg');
  try {
    set({ status: 'downloading', progress: 0 });
    const res = await net.fetch(state.asset.url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const total = +res.headers.get('content-length') || state.asset.size || 0;
    const out = fs.createWriteStream(dmg), reader = res.body.getReader();
    let got = 0, lastSent = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.write(Buffer.from(value)); got += value.length;
      if (total && Date.now() - lastSent > 150) { lastSent = Date.now(); set({ progress: Math.round(got / total * 100) }); }
    }
    await new Promise((res2, rej) => out.end(err => err ? rej(err) : res2()));
    set({ status: 'installing', progress: 100 });
    const mnt = path.join(dir, 'mnt');
    await new Promise((res2, rej) => execFile('hdiutil', ['attach', '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mnt, dmg], e => e ? rej(e) : res2()));
    const newApp = fs.readdirSync(mnt).find(n => n.endsWith('.app'));
    if (!newApp) throw new Error('no app in the update');
    const dest = appBundle();
    // runs after this app has quit: swap the bundle (keeping the old one if the copy fails), then reopen
    const script = path.join(dir, 'swap.sh');
    fs.writeFileSync(script, `#!/bin/bash
while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done
DEST=${JSON.stringify(dest)}
rm -rf "$DEST.old"
mv "$DEST" "$DEST.old" && ditto ${JSON.stringify(path.join(mnt, newApp))} "$DEST" && rm -rf "$DEST.old" || { rm -rf "$DEST"; mv "$DEST.old" "$DEST"; }
xattr -cr "$DEST"
hdiutil detach ${JSON.stringify(mnt)} -quiet
rm -rf ${JSON.stringify(dir)}
open "$DEST"
`, { mode: 0o755 });
    spawn('/bin/bash', [script], { detached: true, stdio: 'ignore' }).unref();
    app.emit('madar-quit-for-update');
    app.quit();
  } catch (e) {
    set({ status: 'available', error: e.message });
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/* ---------- Windows ---------- */
function setupWindows() {
  const { autoUpdater } = require('electron-updater');
  winUpdater = autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => set({ status: 'checking' }));
  autoUpdater.on('update-not-available', () => set({ status: 'latest', version: currentVersion() }));
  autoUpdater.on('update-available', info => set({ status: 'downloading', version: info.version, progress: 0 }));
  autoUpdater.on('download-progress', p => set({ status: 'downloading', progress: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', info => set({ status: 'ready', version: info.version }));
  autoUpdater.on('error', e => set({ status: 'error', error: e?.message || String(e) }));
}

/* ---------- shared ---------- */
function check(manual = false) {
  if (!app.isPackaged && !process.env.MADAR_FAKE_VERSION) return set({ status: 'latest', version: currentVersion(), manual, dev: true });
  if (process.platform === 'darwin') return checkMac(manual);
  if (process.platform === 'win32') { state.manual = manual; return winUpdater.checkForUpdates().catch(e => set({ status: 'error', error: e.message, manual })); }
}
function install() {
  if (process.platform === 'darwin') return installMac();
  if (process.platform === 'win32' && state.status === 'ready') { app.emit('madar-quit-for-update'); winUpdater.quitAndInstall(true, true); }
}
function start(onChange) {
  send = onChange;
  if (process.platform === 'win32' && (app.isPackaged || process.env.MADAR_FAKE_VERSION)) setupWindows();
  setTimeout(() => check(false), 8000);
  timer = setInterval(() => check(false), EVERY);
}
module.exports = { start, check, install, getState: () => state, newer };
