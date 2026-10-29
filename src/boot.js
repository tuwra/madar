'use strict';
/* ---------- boot ---------- */

// bring data saved by older versions up to the current shape
function migrate(st) {
  st.habits ||= [];
  for (const p of st.pages || []) {
    p.parentId ??= null; p.cover ??= null;
    for (const b of p.blocks) {
      if (b.html === undefined && 'text' in b && !['code', 'math'].includes(b.type)) { b.html = esc(b.text); delete b.text; }
      if (b.type === 'callout') b.icon ||= '💡';
    }
  }
  for (const nb of st.notebooks || []) {
    nb.kind ||= 'notebook'; nb.paperColor ||= 'white';
    if (nb.paper === 'planner') nb.paper = 'weekly';
    for (const pg of nb.pages) {
      pg.items ||= []; pg.strokes ||= []; pg.w ||= 1000; pg.h ||= 1414;
      if (pg.paper === 'planner') pg.paper = 'weekly';
    }
  }
  return st;
}

(async () => {
  try {
    await store.open();
    state = await store.loadState();
    if (desktop) store.mtime = await desktop.stateMtime();
  } catch (err) {
    console.error(err);
    setTimeout(() => ask('ما قدرت أفتح مكان حفظ البيانات، فالتغييرات ما راح تنحفظ: ' + esc(err.message), null));
  }
  if (!state) { state = seed(); flush(); }
  migrate(state);
  loadInkPrefs(state);
  if (addOnboarding(state)) flush();
  render();
})();
