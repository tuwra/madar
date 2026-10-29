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
console.log('merge tests passed');
