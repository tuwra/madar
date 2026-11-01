// Two devices edit the same data offline, then sync through a shared "cloud" copy.
require('../src/merge.js');
const { stamp, remember, merge, forCloud } = globalThis.MadarMerge;
const assert = require('assert');
const clone = o => JSON.parse(JSON.stringify(o));

const base = {
  lists: [{ id: 'inbox', name: 'الوارد' }],
  tasks: [{ id: 't1', title: 'one' }, { id: 't2', title: 'two' }, { id: 't3', title: 'three' }],
  events: [], habits: [{ id: 'h1', name: 'water', log: {} }],
  pages: [{ id: 'p1', title: 'note', blocks: [{ id: 'b1', type: 'p', html: 'hi' }] }],
  notebooks: [{ id: 'n1', name: 'book', pages: [{ id: 'g1', strokes: [] }, { id: 'g2', strokes: [] }] }],
};
// both devices start from the same synced copy
let cloud = null;
function sync(dev, now) {
  stamp(dev, now);
  const merged = cloud ? merge(dev, cloud) : dev;
  cloud = clone(forCloud(merged));
  remember(merged);
  return merged;
}
let mac = clone(base), ipad = clone(base);
mac = sync(mac, 1); ipad = sync(ipad, 2);

// offline edits on both
mac.tasks.find(t => t.id === 't1').title = 'one (mac)';            // mac edits t1
mac.tasks = mac.tasks.filter(t => t.id !== 't2');                   // mac deletes t2
mac.notebooks[0].pages[0].strokes.push({ pts: [[1, 1, .5]] });      // mac draws on page g1
ipad.tasks.find(t => t.id === 't3').title = 'three (ipad)';        // ipad edits t3
ipad.tasks.push({ id: 't4', title: 'four (ipad)' });                // ipad adds t4
ipad.habits[0].log['2026-10-29'] = 3;                               // ipad logs water
ipad.notebooks[0].pages[1].strokes.push({ pts: [[2, 2, .5]] });     // ipad draws on page g2
ipad.notebooks[0].pages.push({ id: 'g3', strokes: [] });            // ipad adds a page

mac = sync(mac, 10);   // mac syncs first
ipad = sync(ipad, 20); // ipad syncs, sees mac's changes
mac = sync(mac, 30);   // mac syncs again, sees ipad's changes

for (const [name, d] of [['mac', mac], ['ipad', ipad]]) {
  const titles = d.tasks.map(t => t.title).sort();
  assert.deepStrictEqual(titles, ['four (ipad)', 'one (mac)', 'three (ipad)'], name + ' tasks');
  assert.strictEqual(d.habits[0].log['2026-10-29'], 3, name + ' habit');
  const nb = d.notebooks[0];
  assert.deepStrictEqual(nb.pages.map(p => p.id), ['g1', 'g2', 'g3'], name + ' page order');
  assert.strictEqual(nb.pages[0].strokes.length, 1, name + ' mac stroke');
  assert.strictEqual(nb.pages[1].strokes.length, 1, name + ' ipad stroke');
}
// the same task edited on both: the later edit wins
mac.tasks.find(t => t.id === 't1').title = 'mac again'; ipad.tasks.find(t => t.id === 't1').title = 'ipad later';
mac = sync(mac, 40); ipad = sync(ipad, 50); mac = sync(mac, 60);
assert.strictEqual(mac.tasks.find(t => t.id === 't1').title, 'ipad later');
assert.strictEqual(ipad.tasks.find(t => t.id === 't1').title, 'ipad later');
// a page deleted on one device stays deleted
ipad.pages = []; ipad = sync(ipad, 70); mac = sync(mac, 80);
assert.strictEqual(mac.pages.length, 0, 'deleted page');
// nothing changed: a sync reports zero local changes
assert.strictEqual(stamp(mac, 90), 0, 'no false changes');

// ---------- starter content: every device seeds its own copies
const { dropStarter, dedupeStarter } = globalThis.MadarMerge;
const guide = id => ({ id, title: 'guide', parentId: null, blocks: [{ id: id + 'b', type: 'p', html: 'how to' }, { id: id + 'l', type: 'page', pageId: id + 'c' }] });
const sub = id => ({ id: id + 'c', title: 'sub', parentId: id, blocks: [{ id: id + 'x', type: 'p', html: 'child' }] });
const starter = id => ({
  lists: [{ id: 'inbox', name: 'in' }, { id: id + 'L', name: 'personal' }],
  tasks: [{ id: id + 'T', title: 'try me', listId: 'inbox' }], events: [{ id: id + 'E', title: 'example' }], habits: [],
  pages: [guide(id), sub(id)],
  notebooks: [{ id: id + 'N', name: 'first', pages: [{ id: id + 'P', strokes: [], items: [] }] }],
});
const fresh = starter('fresh');
// an existing account already holding three copies, one of them edited
const dup = { ...starter('b'), sync: { deleted: {}, prints: {} } };
for (const k of ['lists', 'tasks', 'events', 'pages', 'notebooks']) dup[k] = [...dup[k], ...starter('a')[k].filter(i => i.id !== 'inbox'), ...starter('c')[k].filter(i => i.id !== 'inbox')];
dup.pages.find(p => p.id === 'c').blocks[0].html = 'my own edit';
dup.tasks.push({ id: 'mine', title: 'real task', listId: 'cL' });
dedupeStarter(dup, fresh, 1000);
assert.deepStrictEqual(dup.pages.filter(p => p.title === 'guide').map(p => p.id).sort(), ['a', 'c'], 'one pristine guide, edited one kept');
assert.strictEqual(dup.pages.find(p => p.title === 'sub' && p.parentId === 'a').id, 'ac', 'kept guide keeps its own sub-page');
assert.strictEqual(dup.pages.find(p => p.id === 'cc').parentId, 'c', 'sub-page of the edited guide stays');
assert.strictEqual(dup.lists.filter(l => l.name === 'personal').length, 1, 'one list');
assert.strictEqual(dup.tasks.find(t => t.id === 'mine').listId, 'aL', 'real task follows its list');
assert.strictEqual(dup.tasks.filter(t => t.title === 'try me').length, 1, 'one example task');
assert.strictEqual(dup.notebooks.length, 1, 'one empty notebook');
assert.strictEqual(dup.sync.deleted['pages:b'], 1000, 'copies are tombstoned for other devices');
// a new device loses only its untouched starter content
const dev = { ...starter('n'), sync: { deleted: {}, prints: {} } };
dev.notebooks.push({ id: 'drawn', name: 'first', pages: [{ id: 'q', strokes: [{}], items: [] }] });
dev.tasks.push({ id: 'keep', title: 'written here', listId: 'nL' });
dropStarter(dev, fresh);
assert.deepStrictEqual(dev.pages, [], 'guide gone');
assert.deepStrictEqual(dev.notebooks.map(n => n.id), ['drawn'], 'drawn notebook kept');
assert.deepStrictEqual(dev.tasks.map(t => t.id), ['keep'], 'own task kept');
assert.ok(dev.lists.some(l => l.id === 'nL'), 'list in use kept');

// ---------- a notebook kept on one device
cloud = null;
let a = clone(base), b = clone(base);
a = sync(a, 100); b = sync(b, 110); a = sync(a, 120);
a.notebooks[0].localOnly = true; a.sync.deleted['nb:n1'] = 130;
a = sync(a, 140);
assert.strictEqual(a.notebooks.length, 1, 'stays on its device');
assert.strictEqual(cloud.notebooks.length, 0, 'not in the cloud');
b = sync(b, 150);
assert.strictEqual(b.notebooks.length, 0, 'leaves the other device');
a = sync(a, 160);
assert.strictEqual(a.notebooks.length, 1, 'still here after syncing again');
delete a.notebooks[0].localOnly;
a = sync(a, 170); b = sync(b, 180);
assert.strictEqual(b.notebooks.length, 1, 'turning sync back on brings it back');
console.log('merge tests passed');
