'use strict';
/* ---------- merging two copies of the data, item by item ----------
 * Every task, event, list, page, habit, notebook and notebook page has an id. Since the last
 * sync, each device notes which items it changed (by comparing a fingerprint of each item) and
 * when, and which ids it deleted. Merging keeps, for each id, the newest version — unless the
 * item was deleted after that. No device ever overwrites the other's unrelated changes.
 * Pure functions, no DOM: shared by the app and its tests.
 */
(function (root) {
  const COLLECTIONS = ['lists', 'tasks', 'events', 'pages', 'habits', 'sessions', 'days'];

  function fnv(str) { // fast fingerprint of a string
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + ':' + str.length;
  }
  const strip = o => { const { _u, ...rest } = o; return rest; };
  const fp = o => fnv(JSON.stringify(strip(o)));
  const nbMeta = nb => { const { pages, _u, ...m } = nb; return { ...m, pageIds: (pages || []).map(p => p.id) }; };

  // note what changed locally since the last sync: stamp `_u` on changed items, tombstone deleted ids
  function stamp(st, now = Date.now()) {
    const sync = st.sync ||= { prints: {}, deleted: {} };
    const prints = sync.prints, seen = new Set();
    let changed = 0;
    const mark = (key, obj, print) => {
      seen.add(key);
      if (prints[key] !== print) { obj._u = now; prints[key] = print; changed++; }
    };
    for (const c of COLLECTIONS) for (const it of st[c] || []) mark(`${c}:${it.id}`, it, fp(it));
    for (const nb of st.notebooks || []) {
      mark(`nb:${nb.id}`, nb, fnv(JSON.stringify(nbMeta(nb))));
      for (const pg of nb.pages || []) mark(`pg:${nb.id}:${pg.id}`, pg, fp(pg));
    }
    for (const key of Object.keys(prints)) {
      if (seen.has(key)) continue;
      sync.deleted[key] = now; delete prints[key]; changed++;
    }
    return changed;
  }
  // after a merge, remember the merged versions as "seen", so they don't count as local changes
  function remember(st) {
    const prints = st.sync.prints = {};
    for (const c of COLLECTIONS) for (const it of st[c] || []) prints[`${c}:${it.id}`] = fp(it);
    for (const nb of st.notebooks || []) {
      prints[`nb:${nb.id}`] = fnv(JSON.stringify(nbMeta(nb)));
      for (const pg of nb.pages || []) prints[`pg:${nb.id}:${pg.id}`] = fp(pg);
    }
  }
  function mergeDeleted(a = {}, b = {}) {
    const out = { ...a };
    for (const [k, t] of Object.entries(b)) if (!(out[k] >= t)) out[k] = t;
    // forget deletions older than 90 days (measured against the newest one, so clocks don't matter)
    const newest = Math.max(0, ...Object.values(out));
    for (const [k, t] of Object.entries(out)) if (newest - t > 90 * 864e5) delete out[k];
    return out;
  }
  // newest version of each id wins, unless it was deleted later; keeps local objects when they win
  function mergeList(local = [], remote = [], deleted, prefix) {
    const byId = new Map();
    for (const it of remote) byId.set(it.id, it);
    for (const it of local) {
      const r = byId.get(it.id);
      if (!r || (it._u || 0) >= (r._u || 0)) byId.set(it.id, it);
    }
    const out = [];
    const order = [...local.map(i => i.id), ...remote.map(i => i.id).filter(id => !local.some(l => l.id === id))];
    for (const id of order) {
      const it = byId.get(id);
      if (!it) continue;
      const del = deleted[`${prefix}:${id}`];
      if (del && del >= (it._u || 0)) continue;
      out.push(it);
    }
    return out;
  }
  function mergeNotebook(local, remote, deleted) {
    if (!remote) return local;
    if (!local) return remote;
    const meta = (local._u || 0) >= (remote._u || 0) ? local : remote;
    const pages = mergeList(local.pages, remote.pages, deleted, `pg:${local.id}`);
    const order = meta.pageIds || (meta.pages || []).map(p => p.id);
    pages.sort((a, b) => (order.indexOf(a.id) + 1 || 1e9) - (order.indexOf(b.id) + 1 || 1e9));
    const { pageIds, ...m } = meta;
    return { ...m, pages };
  }
  // the whole merge: `remote` is what the cloud has; returns the merged state (keeping st.sync)
  function merge(st, remote) {
    const deleted = mergeDeleted(st.sync?.deleted, remote.deleted);
    const out = { ...st };
    for (const c of COLLECTIONS) out[c] = mergeList(st[c], remote[c], deleted, c);
    // a notebook kept on this device ignores whatever the cloud says about it
    const solo = new Set((st.notebooks || []).filter(nb => nb.localOnly).map(nb => nb.id));
    const remoteNbs = (remote.notebooks || []).filter(nb => !solo.has(nb.id));
    const nbDeleted = { ...deleted };
    for (const id of solo) delete nbDeleted[`nb:${id}`];
    const nbs = mergeList(st.notebooks, remoteNbs, nbDeleted, 'nb');
    out.notebooks = nbs.map(nb => mergeNotebook((st.notebooks || []).find(x => x.id === nb.id), remoteNbs.find(x => x.id === nb.id), deleted));
    out.sync = { ...(st.sync || {}), deleted };
    return out;
  }
  // what goes to the cloud: everything except per-device state
  function forCloud(st) {
    const { sync, ...rest } = st;
    return { ...rest, deleted: sync?.deleted || {}, notebooks: (st.notebooks || []).filter(nb => !nb.localOnly).map(nb => ({ ...nb, pageIds: nb.pages.map(p => p.id) })) };
  }

  /* ---------- starter content ----------
   * Every device creates its own guides and examples with its own ids, so merging would pile up
   * copies. An item counts as starter content only while it still matches a fresh copy, so
   * anything the user changed is never touched. `fresh` is what seed() makes.
   */
  const SIGS = {
    lists: l => (l.id === 'inbox' ? null : l.name),
    tasks: t => (t.done ? null : t.title),
    events: e => e.title,
    pages: p => JSON.stringify([p.title, (p.blocks || []).map(b => [b.type, b.html ?? b.text ?? '', b.rows || 0])]),
    notebooks: nb => JSON.stringify([nb.name, (nb.pages || []).filter(pg => pg.strokes?.length || pg.items?.length)
      .map(pg => [pg.strokes?.length || 0, (pg.items || []).map(it => [it.type, it.text ?? it.html ?? ''])])]),
  };
  function starterItems(st, fresh, c) {
    const known = new Set((fresh[c] || []).map(SIGS[c]).filter(Boolean));
    return (st[c] || []).filter(it => { const s = SIGS[c](it); return s && known.has(s); });
  }
  // first sync of a device: the cloud already has the real data, so its untouched starter content goes
  function dropStarter(st, fresh) {
    const gone = c => new Set(starterItems(st, fresh, c));
    for (const c of ['tasks', 'events', 'pages', 'notebooks']) { const g = gone(c); st[c] = (st[c] || []).filter(it => !g.has(it)); }
    const used = new Set((st.tasks || []).map(t => t.listId)), lists = gone('lists');
    st.lists = (st.lists || []).filter(l => !lists.has(l) || used.has(l.id));
    const ids = new Set((st.pages || []).map(p => p.id));
    for (const p of st.pages || []) if (p.parentId && !ids.has(p.parentId)) p.parentId = null;
  }
  // devices that already merged have several copies: keep one (the same one everywhere) and delete the rest
  function dedupeStarter(st, fresh, now = Date.now()) {
    const del = st.sync.deleted ||= {}, moved = new Map();
    let removed = 0;
    for (const c of ['lists', 'tasks', 'events', 'notebooks', 'pages']) {
      const groups = new Map();
      for (const it of starterItems(st, fresh, c)) { const s = SIGS[c](it); groups.set(s, [...(groups.get(s) || []), it]); }
      // roots first, so a guide's sub-page stays with the guide that is kept (the guide links to it by id)
      const ordered = [...groups.values()].sort((a, b) => (a[0].parentId ? 1 : 0) - (b[0].parentId ? 1 : 0));
      for (const copies of ordered) {
        if (copies.length < 2) continue;
        // a sub-page whose guide survives stays: that guide links to it
        const alive = it => it.parentId && !moved.has(it.parentId);
        const rest = copies.filter(it => !alive(it)).sort((a, b) => (a.id < b.id ? -1 : 1));
        const keep = copies.find(alive) || rest.shift();
        for (const it of rest) { moved.set(it.id, keep.id); del[`${c === 'notebooks' ? 'nb' : c}:${it.id}`] = now; removed++; }
        const dead = new Set(rest);
        st[c] = st[c].filter(it => !dead.has(it));
      }
    }
    for (const t of st.tasks || []) if (moved.has(t.listId)) t.listId = moved.get(t.listId);
    for (const p of st.pages || []) if (moved.has(p.parentId)) p.parentId = moved.get(p.parentId);
    return removed;
  }
  root.MadarMerge = { stamp, remember, merge, forCloud, mergeDeleted, fp, dropStarter, dedupeStarter };
})(typeof window !== 'undefined' ? window : globalThis);
