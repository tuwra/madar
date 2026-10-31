'use strict';
/* ---------- sync through the user's own Google Drive ----------
 * Files live in a "Madar Sync" folder the app creates (drive.file scope: the app can only see
 * files it made). madar.json holds everything except notebook pages; each notebook's pages go in
 * nb-<id>.json; images, PDFs and attachments go up once each as b_<key>.
 */
const GCFG = window.MADAR_GOOGLE || {};
const isIOS = !!window.Capacitor?.isNativePlatform?.();
const cloud = { status: 'off', email: '', lastSync: 0, error: '', busy: false, folder: null, files: null, timer: null, dirtyTimer: null };
const SCOPE = 'https://www.googleapis.com/auth/drive.file openid email';
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
// `test` lets the browser test suite run the sync against a fake Drive
const configured = () => GCFG.test || (isIOS ? !!GCFG.iosId : desktop ? !!(GCFG.desktopId && GCFG.desktopSecret) : false);

/* ---------- tokens ---------- */
const tokens = {
  async load() {
    try {
      const raw = desktop ? await desktop.secret.get('google') : localStorage.getItem('madar-google');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  async save(t) {
    const raw = t ? JSON.stringify(t) : '';
    if (desktop) await desktop.secret.set('google', raw); else if (raw) localStorage.setItem('madar-google', raw); else localStorage.removeItem('madar-google');
  },
};
let tok = null;
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = n => b64url(crypto.getRandomValues(new Uint8Array(n)));
function client() {
  if (isIOS) {
    const id = GCFG.iosId, scheme = 'com.googleusercontent.apps.' + id.replace('.apps.googleusercontent.com', '');
    return { id, secret: null, redirect: `${scheme}:/oauth2redirect` };
  }
  return { id: GCFG.desktopId, secret: GCFG.desktopSecret, redirect: null };
}
async function tokenRequest(params) {
  const c = client();
  const body = new URLSearchParams({ client_id: c.id, ...(c.secret ? { client_secret: c.secret } : {}), ...params });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error_description || j.error || 'token error');
  return j;
}
async function signIn(withCal = !!tok?.cal) {
  if (!configured()) return ask('المزامنة ما انعدّت في هذي النسخة للحين.', null);
  const c = client(), verifier = rand(48);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  let redirect = c.redirect, code;
  setStatus('signing');
  try {
    if (!isIOS) redirect = `http://127.0.0.1:${await desktop.oauth.listen()}`;
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: c.id, redirect_uri: redirect, response_type: 'code', scope: withCal ? `${SCOPE} ${CAL_SCOPE}` : SCOPE, access_type: 'offline', prompt: 'consent',
      code_challenge: challenge, code_challenge_method: 'S256',
    });
    if (isIOS) {
      const { Browser, App } = window.Capacitor.Plugins;
      code = await new Promise((resolve, reject) => {
        let handle;
        App.addListener('appUrlOpen', ev => {
          if (!ev.url.startsWith(redirect)) return;
          handle?.remove?.(); Browser.close().catch(() => {});
          const u = new URL(ev.url); u.searchParams.get('code') ? resolve(u.searchParams.get('code')) : reject(new Error(u.searchParams.get('error') || 'cancelled'));
        }).then(h => { handle = h; });
        Browser.open({ url, presentationStyle: 'popover' });
        Browser.addListener?.('browserFinished', () => setTimeout(() => reject(new Error('cancelled')), 1500));
      });
    } else {
      window.open(url, '_blank');
      const r = await desktop.oauth.wait();
      if (!r.code) throw new Error(r.error || 'cancelled');
      code = r.code;
    }
    const t = await tokenRequest({ code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' });
    const email = t.id_token ? JSON.parse(atob(t.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email : '';
    tok = { refresh: t.refresh_token, access: t.access_token, exp: Date.now() + t.expires_in * 1000, email, cal: withCal };
    await tokens.save(tok);
    cloud.email = email;
    toast('سجّلت دخول بقوقل. أبدأ المزامنة…');
    startSyncLoop(); syncNow();
    if (withCal) syncCalendar(true);
  } catch (e) {
    setStatus(tok ? 'ok' : 'off', e.message === 'cancelled' ? '' : e.message);
    if (e.message !== 'cancelled') toast('ما زبط تسجيل الدخول: ' + e.message, 4000);
  }
}
async function signOut() {
  stopSyncLoop(); tok = null; await tokens.save(null);
  cloud.email = ''; cloud.folder = null; setStatus('off');
  if (state.sync) state.sync.seen = {};
  save();
}
async function accessToken() {
  if (!tok) throw new Error('signed out');
  if (GCFG.test) return 'test';
  if (tok.access && tok.exp > Date.now() + 60000) return tok.access;
  const t = await tokenRequest({ refresh_token: tok.refresh, grant_type: 'refresh_token' });
  tok = { ...tok, access: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  await tokens.save(tok);
  return tok.access;
}

/* ---------- Drive ---------- */
async function gfetch(url, opts = {}, retry = true) {
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${await accessToken()}` } });
  if (res.status === 401 && retry) { tok.exp = 0; return gfetch(url, opts, false); }
  if (!res.ok) { let m = res.statusText; try { m = (await res.json()).error?.message || m; } catch { /* ignore */ } throw new Error(`Drive ${res.status}: ${m}`); }
  return res;
}
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
async function ensureFolder() {
  if (cloud.folder) return cloud.folder;
  const q = "name='Madar Sync' and mimeType='application/vnd.google-apps.folder' and trashed=false";
  const r = await (await gfetch(`${DRIVE}?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`)).json();
  if (r.files?.[0]) return (cloud.folder = r.files[0].id);
  const made = await (await gfetch(`${DRIVE}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Madar Sync', mimeType: 'application/vnd.google-apps.folder' }) })).json();
  return (cloud.folder = made.id);
}
async function listFiles() {
  const folder = await ensureFolder(), files = new Map();
  let page = '';
  do {
    const q = `'${folder}' in parents and trashed=false`;
    const r = await (await gfetch(`${DRIVE}?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,modifiedTime,size)&pageSize=1000${page ? '&pageToken=' + page : ''}`)).json();
    for (const f of r.files || []) files.set(f.name, f);
    page = r.nextPageToken || '';
  } while (page);
  return (cloud.files = files);
}
const download = async id => gfetch(`${DRIVE}/${id}?alt=media`);
// multipart upload: metadata + content in one request (creates, or replaces the content of `id`)
async function upload(name, blob, id) {
  const folder = await ensureFolder(), boundary = 'madar' + rand(12);
  const meta = id ? {} : { name, parents: [folder] };
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${boundary}--`]);
  const url = `https://www.googleapis.com/upload/drive/v3/files${id ? '/' + id : ''}?uploadType=multipart&fields=id,name,modifiedTime`;
  const f = await (await gfetch(url, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })).json();
  cloud.files?.set(f.name || name, f);
  return f;
}
const jsonBlob = o => new Blob([JSON.stringify(o)], { type: 'application/json' });
const blobName = key => 'b_' + String(key).replace(/[^a-zA-Z0-9_-]/g, '_');

/* ---------- the sync itself ---------- */
function blobKeys(st) {
  const keys = new Set();
  for (const p of st.pages || []) { if (p.cover?.img) keys.add(p.cover.img); for (const b of p.blocks || []) if (b.blob) keys.add(b.blob); }
  for (const nb of st.notebooks || []) { if (nb.pdf) keys.add(nb.pdf); for (const pg of nb.pages || []) for (const it of pg.items || []) if (it.blob) keys.add(it.blob); }
  return keys;
}
function userIsEditing() {
  const a = document.activeElement;
  return !!(a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) || $('#dlg').open;
}
let pendingRender = false;
function firstSyncChoice() {
  return new Promise(resolve => {
    let answered = false;
    openDialog(`<h3>لقيت بياناتك في قوقل درايف</h3>
      <p class="note">هذا الجهاز فيه بيانات بعد. وش تبي نسوي؟</p>
      <button class="btn primary" value="cloud">استخدم البيانات اللي في قوقل درايف (مستحسن لجهاز جديد)</button>
      <button class="btn" value="merge">ادمجها مع بيانات هذا الجهاز</button>`, (fd, v) => { answered = true; resolve(v === 'merge' ? 'merge' : 'cloud'); });
    dlg.addEventListener('close', () => { if (!answered) resolve('merge'); }, { once: true });
  });
}
async function syncNow(manual = false) {
  if (!tok || cloud.busy || !configured()) return;
  cloud.busy = true; setStatus('syncing');
  try {
    const M = window.MadarMerge;
    M.stamp(state);
    const sync = state.sync, seen = sync.seen ||= {}, up = sync.up ||= {};
    const files = await listFiles();
    // what the cloud has
    let remote = null;
    const coreF = files.get('madar.json');
    if (coreF) {
      remote = await (await download(coreF.id)).json();
      remote.notebooks = await Promise.all((remote.notebooks || []).map(async nb => {
        const f = files.get(`nb-${nb.id}.json`), mine = state.notebooks.find(x => x.id === nb.id);
        // unchanged since our own last upload: it equals what we already have, so skip the download
        if (f && mine && seen[f.name] === f.modifiedTime) return { ...nb, pages: mine.pages };
        if (!f) return { ...nb, pages: [] };
        return { ...nb, pages: (await (await download(f.id)).json()).pages || [] };
      }));
    }
    let changedHere = 0;
    if (remote && !sync.lastSync && (await firstSyncChoice()) === 'cloud') {
      // start this device from the cloud copy
      const { deleted, ...rest } = remote;
      for (const k of Object.keys(state)) if (k !== 'sync') delete state[k];
      Object.assign(state, rest, { notebooks: rest.notebooks.map(({ pageIds, ...nb }) => nb) });
      state.sync = { prints: {}, deleted: deleted || {}, seen, up };
      migrate(state); M.remember(state);
      for (const nb of state.notebooks) seen[`nb-${nb.id}.json`] = files.get(`nb-${nb.id}.json`)?.modifiedTime;
      seen['madar.json'] = coreF.modifiedTime;
      changedHere = 1; remote = null;
    }
    // merge, then apply without disturbing objects that didn't change
    if (remote) {
      const merged = M.merge(state, remote);
      for (const c of ['lists', 'tasks', 'events', 'pages', 'habits', 'notebooks']) {
        const before = new Set(state[c] || []);
        if ((merged[c] || []).some(x => !before.has(x)) || merged[c].length !== (state[c] || []).length) changedHere++;
      }
      for (const nb of merged.notebooks) {
        const mine = state.notebooks.find(x => x.id === nb.id);
        if (mine && mine !== nb) { Object.assign(mine, nb); merged.notebooks[merged.notebooks.indexOf(nb)] = mine; }
      }
      Object.assign(state, merged);
    }
    // send ours up: the core file, each changed notebook, and any attachment the cloud doesn't have
    const cloudObj = M.forCloud(state);
    const core = { ...cloudObj, v: 2, at: Date.now(), notebooks: cloudObj.notebooks.map(({ pages, ...m }) => m) };
    const corePrint = M.fp({ ...core, at: 0 });
    if (up.core !== corePrint || !coreF) { const f = await upload('madar.json', jsonBlob(core), coreF?.id); up.core = corePrint; seen['madar.json'] = f.modifiedTime; }
    for (const nb of state.notebooks) {
      const name = `nb-${nb.id}.json`, print = M.fp({ pages: nb.pages });
      if (up[name] === print && files.get(name)) continue;
      const f = await upload(name, jsonBlob({ id: nb.id, pages: nb.pages }), files.get(name)?.id);
      up[name] = print; seen[name] = f.modifiedTime;
    }
    for (const key of blobKeys(state)) {
      const name = blobName(key);
      if (files.get(name)) continue;
      const b = await store.getBlob(key, true);
      if (b) await upload(name, b);
    }
    M.remember(state);
    cloud.lastSync = Date.now(); sync.lastSync = cloud.lastSync;
    localSave();
    setStatus('ok');
    if (changedHere) { if (userIsEditing() || (inkApi && ui.view === 'ink')) pendingRender = true; else render(); }
    if (manual) toast('تمت المزامنة ✓');
  } catch (e) {
    console.error(e); setStatus('error', e.message);
    if (manual) toast('ما زبطت المزامنة: ' + e.message, 4000);
  } finally { cloud.busy = false; }
}
// save to this device only (a sync shouldn't trigger another sync)
function localSave() { cloud.quiet = true; flush(); cloud.quiet = false; }

// attachments that came from another device are fetched the first time they're needed
const localGetBlob = store.getBlob.bind(store);
store.getBlob = async (key, localOnly = false) => {
  const b = await localGetBlob(key);
  if (b || localOnly || !tok) return b;
  try {
    const files = cloud.files || await listFiles(), f = files.get(blobName(key));
    if (!f) return null;
    const blob = await (await download(f.id)).blob();
    await store.setBlob(key, blob);
    return blob;
  } catch { return null; }
};

function startSyncLoop() {
  stopSyncLoop();
  cloud.timer = setInterval(() => syncNow(), 60 * 1000);
}
function stopSyncLoop() { clearInterval(cloud.timer); cloud.timer = null; }
// a change syncs a few seconds later
window.addEventListener('madar-saved', () => {
  if (!tok || cloud.quiet) return;
  clearTimeout(cloud.dirtyTimer); cloud.dirtyTimer = setTimeout(() => syncNow(), 4000);
});
window.addEventListener('focus', () => { if (tok) syncNow(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && tok) syncNow(); });
document.addEventListener('focusout', () => { if (pendingRender) setTimeout(() => { if (pendingRender && !userIsEditing() && !(inkApi && ui.view === 'ink')) { pendingRender = false; render(); } }, 300); });

/* ---------- status in the sidebar and the sync window ---------- */
function setStatus(s, err = '') {
  cloud.status = s; cloud.error = err;
  const el = $('[data-act="backup"] span');
  if (el) el.textContent = { off: 'الحفظ والمزامنة', signing: 'يسجّل الدخول…', syncing: 'يزامن…', ok: 'متزامن ✓', error: 'المزامنة ⚠︎' }[s] || 'الحفظ والمزامنة';
  const box = $('#cloud-box'); if (box) box.outerHTML = cloudSection();
}
function cloudSection() {
  const when = cloud.lastSync ? relTime(cloud.lastSync) : '';
  if (!configured()) return `<div id="cloud-box" class="store-now"><b>المزامنة بين أجهزتك</b><div class="hint">المزامنة عن طريق قوقل ما انعدّت في هذي النسخة للحين.</div></div>`;
  if (!tok) return `<div id="cloud-box" class="store-now"><b>زامن الماك والويندوز والآيباد والآيفون</b>
    <div class="hint">سجّل دخول بحساب قوقل في كل جهاز، وبياناتك تتزامن بينها عن طريق مجلد «Madar Sync» في قوقل درايف حقك.</div>
    <button class="btn primary" data-act="cloud-signin" type="button">تسجيل الدخول بقوقل</button></div>`;
  return `<div id="cloud-box" class="store-now ${cloud.status === 'error' ? '' : 'ok'}"><b>${cloud.status === 'syncing' ? 'يزامن…' : cloud.status === 'error' ? 'المزامنة متوقفة' : '✓ متزامن عن طريق قوقل'}</b>
    <div class="hint">${esc(cloud.email)}${when ? ' · آخر مزامنة ' + when : ''}${cloud.error ? ' · ' + esc(cloud.error) : ''}</div>
    <div class="row wrap"><button class="btn small" data-act="cloud-sync" type="button">زامن الحين</button><button class="btn small ghost danger" data-act="cloud-signout" type="button">تسجيل الخروج</button></div>
    <div class="row wrap" style="margin-top:8px">${tok.cal ? '<span class="hint grow">✓ تقويم قوقل مربوط</span><button class="btn small" data-act="gcal-refresh" type="button">حدّث المواعيد</button><button class="btn small ghost" data-act="gcal-off" type="button">فصل</button>' : '<button class="btn small" data-act="gcal-on" type="button">ربط تقويم قوقل</button><span class="hint grow">مواعيدك تظهر في مدار، للقراءة فقط</span>'}</div></div>`;
}
/* ---------- Google Calendar: read only, kept as events marked `gcal` ---------- */
let calBusy = false, calLast = 0;
async function syncCalendar(manual = false) {
  if (!tok?.cal || calBusy || (!manual && Date.now() - calLast < 15 * 60000)) return;
  calBusy = true;
  try {
    const td = parseYmd(todayStr()), from = new Date(td); from.setDate(from.getDate() - 14);
    const to = new Date(td); to.setDate(to.getDate() + 120);
    const API = 'https://www.googleapis.com/calendar/v3';
    const list = await (await gfetch(`${API}/users/me/calendarList`)).json();
    const out = [];
    for (const c of (list.items || []).filter(x => x.selected !== false)) {
      const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '500', timeMin: from.toISOString(), timeMax: to.toISOString() });
      const j = await (await gfetch(`${API}/calendars/${encodeURIComponent(c.id)}/events?${q}`)).json();
      for (const e of j.items || []) out.push(...calEvents(e, c.backgroundColor));
    }
    state.events = [...state.events.filter(e => !e.gcal), ...out];
    calLast = Date.now(); save();
    if (['today', 'calendar'].includes(ui.view)) render();
    if (manual) toast(`تحدّثت مواعيد تقويم قوقل (${out.length})`);
  } catch (e) {
    if (manual) ask(/40[13]/.test(e.message) ? 'قوقل رفض طلب التقويم. تأكد إن «Google Calendar API» مفعّل في مشروعك على Google Cloud، وبعدها اربط التقويم مرة ثانية.' : 'ما قدرت أجيب المواعيد: ' + esc(e.message), null);
  } finally { calBusy = false; }
}
// an all-day event of several days becomes one entry per day
function calEvents(e, color) {
  if (e.status === 'cancelled') return [];
  const base = { title: e.summary || 'بدون عنوان', color: color || COLORS[1], gcal: true, created: 0 };
  if (e.start?.date) {
    const out = [];
    for (let d = e.start.date, i = 0; d < e.end.date && i < 31; d = addDays(d, 1), i++) out.push({ ...base, id: `g_${e.id}_${i}`, date: d, start: '', end: '' });
    return out;
  }
  const s = new Date(e.start.dateTime), en = new Date(e.end.dateTime), hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return [{ ...base, id: `g_${e.id}`, date: ymd(s), start: hm(s), end: ymd(en) === ymd(s) ? hm(en) : '23:59' }];
}
A['gcal-on'] = () => { dlg.close(); signIn(true); };
A['gcal-refresh'] = () => syncCalendar(true);
A['gcal-off'] = async () => { tok.cal = false; await tokens.save(tok); state.events = state.events.filter(e => !e.gcal); save(); dlg.close(); render(); toast('فصلت تقويم قوقل'); };
setInterval(() => syncCalendar(), 5 * 60000);

A['cloud-signin'] = () => signIn();
A['cloud-sync'] = () => syncNow(true);
A['cloud-signout'] = () => ask('تسجّل الخروج؟ بياناتك تبقى على هذا الجهاز وفي قوقل درايف، بس ما راح تتزامن.', 'تسجيل الخروج', signOut);

window.madarCloudTest = { setToken: t => { tok = t; }, syncNow, cloud };
(async () => {
  tok = await tokens.load();
  if (tok && configured()) { cloud.email = tok.email || ''; cloud.lastSync = state?.sync?.lastSync || 0; setStatus('ok'); startSyncLoop(); setTimeout(() => syncNow(), 2500); setTimeout(() => syncCalendar(), 4000); }
})();
