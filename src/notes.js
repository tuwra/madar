'use strict';
/* ---------- notes: Notion-style pages made of blocks ---------- */

let curPage = null;
const TEXT_TYPES = ['p', 'h1', 'h2', 'h3', 'bullet', 'num', 'todo', 'toggle', 'quote', 'callout'];
const isText = b => TEXT_TYPES.includes(b.type);
const CODE_LANGS = { plaintext: 'نص عادي', javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', html: 'HTML', css: 'CSS', json: 'JSON', bash: 'Bash', sql: 'SQL', java: 'Java', c: 'C', cpp: 'C++', csharp: 'C#', go: 'Go', rust: 'Rust', php: 'PHP', ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin', dart: 'Dart', yaml: 'YAML', markdown: 'Markdown' };
const COVERS = ['linear-gradient(135deg,#667eea,#764ba2)', 'linear-gradient(135deg,#f6d365,#fda085)', 'linear-gradient(135deg,#84fab0,#8fd3f4)', 'linear-gradient(135deg,#a18cd1,#fbc2eb)', 'linear-gradient(135deg,#0f2027,#2c5364)', 'linear-gradient(135deg,#ff9a9e,#fecfef)', 'linear-gradient(135deg,#43e97b,#38f9d7)', 'linear-gradient(135deg,#c79081,#dfa579)'];

const SLASH = [
  { g: 'أساسية', t: 'p', n: 'نص', d: 'فقرة عادية', i: 'Aa', k: 'text paragraph نص فقرة' },
  { g: 'أساسية', t: 'h1', n: 'عنوان 1', d: 'عنوان كبير', i: 'H1', k: 'h1 heading title عنوان' },
  { g: 'أساسية', t: 'h2', n: 'عنوان 2', d: 'عنوان متوسط', i: 'H2', k: 'h2 heading عنوان' },
  { g: 'أساسية', t: 'h3', n: 'عنوان 3', d: 'عنوان صغير', i: 'H3', k: 'h3 heading عنوان' },
  { g: 'أساسية', t: 'bullet', n: 'قائمة نقطية', d: 'قائمة بنقاط', i: '•', k: 'bullet list unordered قائمة نقط' },
  { g: 'أساسية', t: 'num', n: 'قائمة مرقمة', d: 'قائمة بأرقام', i: '1.', k: 'number numbered ordered list قائمة مرقمة ارقام' },
  { g: 'أساسية', t: 'todo', n: 'قائمة مهام', d: 'مربعات تشيّكها', i: '☐', k: 'todo task check checkbox مهام مهمة مربع' },
  { g: 'أساسية', t: 'toggle', n: 'قائمة منسدلة', d: 'محتوى تفتحه وتسكره', i: '▸', k: 'toggle collapse منسدلة طي' },
  { g: 'أساسية', t: 'quote', n: 'اقتباس', d: 'نص مقتبس', i: '❝', k: 'quote blockquote اقتباس' },
  { g: 'أساسية', t: 'callout', n: 'ملاحظة بارزة', d: 'نص مميز بأيقونة', i: '💡', k: 'callout note tip تنبيه بارزة ملاحظة' },
  { g: 'أساسية', t: 'divider', n: 'فاصل', d: 'خط يفصل الأقسام', i: '—', k: 'divider line hr فاصل خط' },
  { g: 'أساسية', t: 'page', n: 'صفحة فرعية', d: 'صفحة داخل هذي الصفحة', i: '📄', k: 'page subpage صفحة فرعية' },
  { g: 'أساسية', t: 'link-page', n: 'رابط لصفحة', d: 'رابط لصفحة موجودة', i: '↗', k: 'link mention page رابط صفحة' },
  { g: 'متقدمة', t: 'code', n: 'كود', d: 'كود برمجي بالألوان', i: '</>', k: 'code snippet program كود برمجة' },
  { g: 'متقدمة', t: 'table', n: 'جدول', d: 'جدول بصفوف وأعمدة', i: '▦', k: 'table grid جدول' },
  { g: 'متقدمة', t: 'math', n: 'معادلة', d: 'معادلة رياضية (TeX)', i: '∑', k: 'math equation tex latex معادلة رياضيات' },
  { g: 'متقدمة', t: 'toc', n: 'فهرس المحتويات', d: 'روابط لعناوين الصفحة', i: '☰', k: 'toc contents فهرس محتويات' },
  { g: 'وسائط', t: 'image', n: 'صورة', d: 'ارفع صورة', i: '🖼️', k: 'image picture photo صورة' },
  { g: 'وسائط', t: 'video', n: 'فيديو', d: 'ارفع فيديو', i: '🎬', k: 'video فيديو' },
  { g: 'وسائط', t: 'audio', n: 'صوت', d: 'ارفع ملف صوتي', i: '🎵', k: 'audio sound music صوت' },
  { g: 'وسائط', t: 'file', n: 'ملف', d: 'ارفع أي ملف', i: '📎', k: 'file upload attachment ملف رفع مرفق' },
  { g: 'وسائط', t: 'pdf', n: 'PDF', d: 'اعرض ملف PDF داخل الصفحة', i: '📕', k: 'pdf document كتاب ملف' },
  { g: 'وسائط', t: 'bookmark', n: 'رابط ويب', d: 'رابط لموقع', i: '🔗', k: 'bookmark link url web رابط موقع' },
  { g: 'قوقل درايف', t: 'drive', n: 'ملف من قوقل درايف', d: 'اربط ملف من مجلد درايف', i: '△', k: 'drive google درايف قوقل' },
];

/* ---------- html sanitizing (inline formatting only) ---------- */
const INLINE = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', S: 's', STRIKE: 's', DEL: 's', CODE: 'code', A: 'a', MARK: 'mark', BR: 'br', SPAN: null, FONT: null, DIV: null, P: null };
const MARKS = ['yellow', 'red', 'green', 'blue', 'purple', 'gray'];
function sanitize(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  const walk = (node, out) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const tag = INLINE[n.tagName];
      if (tag === undefined) { walk(n, out); continue; } // unknown tag: keep its text
      if (tag === null) { if (n.tagName !== 'SPAN' && out.lastChild && n.previousSibling) out.appendChild(document.createTextNode('\n')); walk(n, out); continue; }
      const el = document.createElement(tag);
      if (tag === 'a') {
        const href = n.getAttribute('href') || '';
        if (/^(https?:|mailto:)/i.test(href)) el.setAttribute('href', href);
      }
      if (tag === 'mark' && MARKS.includes(n.dataset.c)) el.dataset.c = n.dataset.c;
      if (tag !== 'br') walk(n, el);
      out.appendChild(el);
    }
  };
  const out = document.createElement('div');
  walk(tpl.content, out);
  return out.innerHTML.replace(/<br>$/, '');
}
const plain = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent; };
const textOf = b => isText(b) ? plain(b.html) : b.type === 'code' ? b.text : b.type === 'table' ? b.rows.flat().join(' ') : (b.caption || b.name || b.title || '');
function blockPreview(p) { const b = p.blocks.find(x => textOf(x)); return esc((b ? textOf(b) : '').slice(0, 70)); }

/* ---------- model ---------- */
const blk = (type = 'p', html = '') => {
  const b = { id: uid(), type, html };
  if (type === 'todo') b.checked = false;
  if (type === 'toggle') { b.open = true; b.body = ''; }
  if (type === 'callout') b.icon = '💡';
  if (type === 'code') { b.text = ''; b.lang = 'plaintext'; }
  if (type === 'table') b.rows = [['', '', ''], ['', '', '']];
  if (type === 'math') b.text = '';
  return b;
};
const blankPage = (parentId = null) => ({ id: uid(), title: '', icon: '📄', cover: null, parentId, updated: Date.now(), blocks: [blk('p')] });
function touchPage() { if (curPage) { curPage.updated = Date.now(); save(); } }
const childrenOf = id => state.pages.filter(p => (p.parentId || null) === id);
function ancestors(p) { const out = []; let c = p; while (c?.parentId) { c = state.pages.find(x => x.id === c.parentId); if (c) out.unshift(c); } return out; }

/* ---------- view ---------- */
/* ready-made pages */
const NOTE_TEMPLATES = {
  meeting: ['🤝', 'اجتماع', 'الموضوع، الحضور، النقاط والمهام', () => [blk('callout', 'التاريخ: ' + fmt(todayStr(), { weekday: 'long', day: 'numeric', month: 'long' })), blk('h2', 'الحضور'), blk('bullet'), blk('h2', 'النقاط'), blk('bullet'), blk('h2', 'المهام القادمة'), blk('todo')]],
  journal: ['📔', 'يومياتي', 'كيف كان يومك، وش تعلمت، وش ممتن له', () => [blk('h3', fmt(todayStr(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })), blk('h2', 'كيف كان يومي'), blk('p'), blk('h2', 'ممتن لـ'), blk('num'), blk('h2', 'وش تعلمت'), blk('p')]],
  project: ['🚀', 'مشروع', 'الهدف، الخطوات، المراحل والروابط', () => [blk('callout', 'الهدف: '), blk('h2', 'الخطوات'), blk('todo'), blk('todo'), blk('h2', 'المراحل'), Object.assign(blk('table'), { rows: [['المرحلة', 'الموعد', 'الحالة'], ['', '', ''], ['', '', '']] }), blk('h2', 'روابط وملفات'), blk('bullet')]],
  study: ['🎓', 'مذاكرة', 'ملخص درس بأسئلة ومراجعة', () => [blk('h2', 'الأفكار الرئيسية'), blk('bullet'), blk('h2', 'تعريفات'), blk('toggle', 'مصطلح'), blk('h2', 'أسئلة للمراجعة'), blk('todo'), blk('h2', 'الملخص'), blk('quote')]],
  reading: ['📚', 'قائمة قراءة', 'كتب تبي تقرأها وتقييمها', () => [Object.assign(blk('table'), { rows: [['الكتاب', 'المؤلف', 'الحالة', 'التقييم'], ['', '', 'أبي أقرأه', ''], ['', '', '', '']] }), blk('h2', 'اقتباسات حبيتها'), blk('quote')]],
  week: ['🗓️', 'خطة الأسبوع', 'أهداف الأسبوع وكل يوم', () => [blk('h2', 'أهداف الأسبوع'), blk('todo'), blk('todo'), ...DOW.flatMap(d => [blk('h3', d), blk('todo')])]],
};
function pageFromTemplate(kind, parentId = null) {
  const [icon, name, , make] = NOTE_TEMPLATES[kind];
  const p = blankPage(parentId); p.icon = icon; p.title = name; p.blocks = make();
  return p;
}
function notesSide() {
  const favs = state.pages.filter(p => p.fav);
  return `<aside class="side">
      <input type="search" id="page-search" placeholder="ابحث في الملاحظات…" value="${esc(ui.pageSearch)}">
      <button class="side-item ${ui.pageId === 'home' ? 'active' : ''}" data-act="notes-home"><span>🏠</span>الرئيسية</button>
      ${favs.length ? `<div class="side-label">المفضلة</div>${favs.map(p => `<button class="side-item ${p.id === ui.pageId ? 'active' : ''}" data-act="open-page" data-page="${p.id}"><span>${p.icon}</span><span class="page-item-title">${esc(p.title || 'بدون عنوان')}</span></button>`).join('')}` : ''}
      <div class="side-label">الصفحات</div>
      <div class="page-list"></div>
      <button class="side-item" data-act="new-page" style="color:var(--muted)">＋ صفحة جديدة</button>
    </aside>`;
}
const pageCard = p => `<button class="pcard" data-act="open-page" data-page="${p.id}">
    <span class="pcard-cover" style="${p.cover ? coverStyle(p.cover) : `background:${COVERS[(p.id.charCodeAt(0) + p.id.charCodeAt(1)) % COVERS.length]}`}"></span>
    <span class="pcard-icon">${p.icon}</span>
    <b>${esc(p.title || 'بدون عنوان')}</b>
    <small>${blockPreview(p) || 'صفحة فاضية'}</small>
    <time>${relTime(p.updated)}${p.fav ? ' · ★' : ''}</time>
  </button>`;
function renderNotesHome() {
  ui.expanded ||= {};
  const recent = [...state.pages].sort((a, b) => b.updated - a.updated).slice(0, 12), favs = state.pages.filter(p => p.fav);
  for (const p of state.pages) if (p.cover?.img) blobUrl(p.cover.img);
  view.innerHTML = `<div class="split notes-split">${notesSide()}
    <section class="notes-home">
      <div class="page-head"><div><h1>الملاحظات</h1><div class="sub">${state.pages.length} صفحة</div></div><button class="btn primary" data-act="new-page">صفحة جديدة</button></div>
      <h2>ابدأ من قالب</h2>
      <div class="tpl-cards">${Object.entries(NOTE_TEMPLATES).map(([k, [icon, name, desc]]) => `<button class="tcard" data-act="new-from-tpl" data-t="${k}"><span>${icon}</span><b>${name}</b><small>${desc}</small></button>`).join('')}</div>
      ${favs.length ? `<h2>المفضلة</h2><div class="pcards">${favs.map(pageCard).join('')}</div>` : ''}
      <h2>آخر التعديلات</h2>
      <div class="pcards">${recent.map(pageCard).join('')}</div>
    </section></div>`;
  renderPageList();
  $('#page-search').addEventListener('input', e => { ui.pageSearch = e.target.value; renderPageList(); });
}
function renderNotes() {
  if (ui.pageId === 'home') return renderNotesHome();
  if (!state.pages.length) state.pages.push(blankPage());
  curPage = state.pages.find(p => p.id === ui.pageId) || [...state.pages].sort((a, b) => b.updated - a.updated)[0];
  ui.pageId = curPage.id;
  ui.expanded ||= {};
  for (const a of ancestors(curPage)) ui.expanded[a.id] = true;
  const crumbs = ancestors(curPage);
  const words = curPage.blocks.map(textOf).join(' ').split(/\s+/).filter(Boolean).length;
  const isEmpty = !curPage.title && curPage.blocks.length <= 1 && !curPage.blocks.some(textOf);
  view.innerHTML = `<div class="split notes-split">
    ${notesSide()}
    <section class="doc-wrap">
      ${curPage.cover ? `<div class="cover" style="${coverStyle(curPage.cover)}"><div class="cover-tools"><button class="btn small" data-act="cover">تغيير الغلاف</button><button class="btn small" data-act="cover-remove">إزالة</button></div></div>` : ''}
      <div class="doc">
        <div class="doc-top">
          <div class="crumbs">${crumbs.map(c => `<button class="crumb" data-act="open-page" data-page="${c.id}">${c.icon} ${esc(c.title || 'بدون عنوان')}</button><span>/</span>`).join('')}</div>
          <span class="grow"></span>
          <span class="doc-meta">${words} كلمة · ${relTime(curPage.updated)}</span>
          <button class="btn small ghost fav-btn ${curPage.fav ? 'on' : ''}" data-act="page-fav" title="المفضلة">${curPage.fav ? '★' : '☆'}</button>
          ${curPage.cover ? '' : '<button class="btn small ghost" data-act="cover">🖼️ غلاف</button>'}
          <button class="btn small ghost danger" data-act="del-page">حذف الصفحة</button>
        </div>
        <button class="page-icon" data-act="icon" title="غيّر الأيقونة">${curPage.icon}</button>
        <div class="doc-title" contenteditable="true" data-ph="بدون عنوان" spellcheck="false">${esc(curPage.title)}</div>
        ${isEmpty ? `<div class="tpl-inline"><span class="hint">ابدأ بقالب:</span>${Object.entries(NOTE_TEMPLATES).map(([k, [icon, name]]) => `<button class="chip-btn" data-act="apply-tpl" data-t="${k}">${icon} ${name}</button>`).join('')}</div>` : ''}
        <div class="blocks"></div>
        <div class="doc-end" data-act="doc-end"></div>
        <div class="doc-hint">اكتب <code>/</code> لكل الأوامر · <code># </code> عنوان · <code>- </code> قائمة · <code>1. </code> مرقمة · <code>[] </code> مهمة · <code>&gt; </code> اقتباس · <code>\`\`\`</code> كود · <code>---</code> فاصل · حدد نص عشان تنسّقه</div>
      </div>
    </section>
  </div>`;
  renderPageList();
  renderBlocks();
  const title = $('.doc-title');
  title.addEventListener('input', () => {
    curPage.title = title.textContent; if (!title.textContent) title.innerHTML = '';
    touchPage(); renderPageList();
  });
  title.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!curPage.blocks.length || !isText(curPage.blocks[0])) { curPage.blocks.unshift(blk('p')); renderBlocks(); }
      focusBlock(curPage.blocks[0].id, 0);
    }
  });
  $('#page-search').addEventListener('input', e => { ui.pageSearch = e.target.value; renderPageList(); });
  const blocks = $('.blocks');
  blocks.addEventListener('input', onBlockInput);
  blocks.addEventListener('keydown', onBlockKey);
  blocks.addEventListener('paste', onPaste);
  blocks.addEventListener('focusout', e => { if (e.target.matches('.code')) highlightCode(e.target, false); });
  setupDrag(blocks);
  cleanup = () => { closeSlash(); hideFmt(); };
  if (!curPage.title && !curPage.blocks.some(textOf)) title.focus();
}
const coverStyle = c => c.img ? `background-image:url('${esc(blobUrls.get(c.img) || '')}')` : `background:${c.bg}`;

function renderPageList() {
  const box = $('.page-list'); if (!box) return;
  const q = ui.pageSearch.trim();
  if (q) {
    const hits = [...state.pages].sort((a, b) => b.updated - a.updated).filter(p => p.title.includes(q) || p.blocks.some(b => textOf(b).includes(q)));
    box.innerHTML = hits.map(p => pageItem(p, 0, false)).join('') || '<div class="hint" style="padding:8px">ما فيه نتائج</div>';
    return;
  }
  const tree = (parent, depth) => childrenOf(parent).sort((a, b) => (a.order ?? a.updated) - (b.order ?? b.updated))
    .map(p => pageItem(p, depth, childrenOf(p.id).length > 0) + (ui.expanded[p.id] ? tree(p.id, depth + 1) : '')).join('');
  box.innerHTML = tree(null, 0);
}
function pageItem(p, depth, hasKids) {
  return `<div class="page-row ${p.id === ui.pageId ? 'active' : ''}" style="--d:${depth}">
    <button class="pr-tog" data-act="page-expand" data-page="${p.id}" ${hasKids ? '' : 'style="visibility:hidden"'}>${ui.expanded[p.id] ? '▾' : '◂'}</button>
    <button class="side-item" data-act="open-page" data-page="${p.id}"><span>${p.icon}</span><span class="page-item-title">${esc(p.title || 'بدون عنوان')}</span></button>
    <button class="pr-add" data-act="new-subpage" data-page="${p.id}" title="صفحة فرعية">＋</button>
  </div>`;
}

/* ---------- block rendering ---------- */
function blockHtml(b, num) {
  const handle = `<div class="blk-handle" contenteditable="false"><button data-act="blk-add" title="أضف تحت">＋</button><button class="grip" data-act="blk-menu" draggable="true" title="اسحب للترتيب أو اضغط للخيارات">⋮⋮</button></div>`;
  const ph = { p: 'اكتب، أو اكتب / للأوامر…', h1: 'عنوان 1', h2: 'عنوان 2', h3: 'عنوان 3', bullet: 'عنصر', num: 'عنصر', todo: 'مهمة', toggle: 'قائمة منسدلة', quote: 'اقتباس', callout: 'اكتب ملاحظة…' }[b.type];
  const text = `<div class="blk-text" contenteditable="true" data-ph="${ph}">${sanitize(b.html)}</div>`;
  let main;
  switch (b.type) {
    case 'todo': main = `<button class="blk-check ${b.checked ? 'on' : ''}" data-act="blk-check" aria-label="تم"></button>${text}`; break;
    case 'bullet': main = `<span class="bullet">•</span>${text}`; break;
    case 'num': main = `<span class="bullet num">${num}.</span>${text}`; break;
    case 'toggle': main = `<button class="tog ${b.open ? 'open' : ''}" data-act="blk-toggle">◂</button><div class="tog-wrap">${text}${b.open ? `<div class="tog-body" contenteditable="true" data-field="body" data-ph="محتوى القائمة المنسدلة…">${esc(b.body)}</div>` : ''}</div>`; break;
    case 'callout': main = `<button class="callout-icon" data-act="callout-icon">${b.icon}</button>${text}`; break;
    case 'divider': main = '<hr>'; break;
    case 'code': main = `<div class="code-wrap"><div class="code-bar"><select data-change="code-lang">${Object.entries(CODE_LANGS).map(([k, v]) => `<option value="${k}" ${k === b.lang ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="grow"></span><button class="btn small ghost" data-act="code-copy">نسخ</button></div><pre class="code" contenteditable="true" spellcheck="false" data-field="code">${codeHtml(b.text, b.lang)}</pre></div>`; break;
    case 'table': main = `<div class="tbl-wrap"><table class="tbl">${b.rows.map((r, ri) => `<tr>${r.map((c, ci) => `<td contenteditable="true" data-r="${ri}" data-c="${ci}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table><div class="tbl-tools"><button class="btn small ghost" data-act="tbl" data-op="row+">＋ صف</button><button class="btn small ghost" data-act="tbl" data-op="col+">＋ عمود</button><button class="btn small ghost" data-act="tbl" data-op="row-">− صف</button><button class="btn small ghost" data-act="tbl" data-op="col-">− عمود</button></div></div>`; break;
    case 'math': main = `<div class="math"><div class="math-view" data-act="math-edit">${mathHtml(b.text)}</div>${b.editing ? `<textarea class="math-src" data-field="math" dir="ltr" placeholder="مثال: \\frac{a}{b} + \\sqrt{x^2}">${esc(b.text)}</textarea>` : ''}</div>`; break;
    case 'toc': main = `<div class="toc">${curPage.blocks.filter(x => /^h[123]$/.test(x.type)).map(h => `<button class="toc-${h.type}" data-act="toc-go" data-to="${h.id}">${esc(plain(h.html) || 'عنوان')}</button>`).join('') || '<span class="hint">أضف عناوين للصفحة وتطلع هنا</span>'}</div>`; break;
    case 'image': main = `<figure class="media"><img data-blob="${b.blob}" alt="">${caption(b)}</figure>`; break;
    case 'video': main = `<figure class="media"><video controls data-blob="${b.blob}"></video>${caption(b)}</figure>`; break;
    case 'audio': main = `<figure class="media"><audio controls data-blob="${b.blob}"></audio>${caption(b)}</figure>`; break;
    case 'pdf': main = `<div class="pdf-embed" data-pdf="${b.blob}"><div class="pdf-head">📕 ${esc(b.name)} <span class="grow"></span><button class="btn small ghost" data-act="file-save">حفظ نسخة</button></div><div class="pdf-pages"><span class="hint">يحمّل…</span></div></div>`; break;
    case 'file': main = `<div class="file-card"><span class="fi">📎</span><div class="grow"><b>${esc(b.name)}</b><div class="hint">${fmtSize(b.size || 0)}</div></div><button class="btn small" data-act="file-open">فتح</button><button class="btn small ghost" data-act="file-save">حفظ نسخة</button>${desktop ? '<button class="btn small ghost" data-act="file-drive">نسخة في درايف</button>' : ''}</div>`; break;
    case 'bookmark': main = `<a class="file-card bm" href="${esc(b.url)}" target="_blank" rel="noopener"><span class="fi">🔗</span><div class="grow"><b>${esc(b.title || hostOf(b.url))}</b><div class="hint" dir="ltr">${esc(b.url)}</div></div></a>`; break;
    case 'drive': main = `<div class="file-card drive"><span class="fi">△</span><div class="grow"><b>${esc(b.name)}</b><div class="hint">${b.missing ? '⚠️ الملف مو موجود في درايف هذا الجهاز' : 'قوقل درايف · ' + fmtSize(b.size || 0)}</div></div><button class="btn small" data-act="drive-open">فتح</button><button class="btn small ghost" data-act="drive-reveal">إظهار في Finder</button></div>`; break;
    case 'page': {
      const t = state.pages.find(p => p.id === b.pageId);
      main = t ? `<button class="page-link" data-act="open-page" data-page="${t.id}">${t.icon} <u>${esc(t.title || 'بدون عنوان')}</u></button>` : '<span class="hint">صفحة محذوفة</span>';
      break;
    }
    default: main = text;
  }
  return `<div class="blk blk-${b.type} ${b.checked ? 'checked' : ''}" data-blk="${b.id}">${handle}<div class="blk-main">${main}</div></div>`;
}
const caption = b => `<figcaption contenteditable="true" data-field="caption" data-ph="أضف وصف…">${esc(b.caption || '')}</figcaption>`;
const hostOf = u => { try { return new URL(u).hostname; } catch { return u; } };

function renderBlocks() {
  const box = $('.blocks'); if (!box) return;
  let n = 0;
  box.innerHTML = curPage.blocks.map(b => { n = b.type === 'num' ? n + 1 : 0; return blockHtml(b, n); }).join('');
  hydrate(box);
}
function rerenderBlock(b) {
  const el = $(`[data-blk="${b.id}"]`); if (!el) return renderBlocks();
  const i = curPage.blocks.indexOf(b);
  let n = 0; for (let k = i; k >= 0 && curPage.blocks[k].type === 'num'; k--) n++;
  const tmp = document.createElement('div'); tmp.innerHTML = blockHtml(b, n);
  el.replaceWith(tmp.firstElementChild);
  hydrate($(`[data-blk="${b.id}"]`).parentElement);
}
function hydrate(root) {
  $$('[data-blob]', root).forEach(async el => { const u = await blobUrl(el.dataset.blob); if (u) el.src = u; });
  $$('[data-pdf]', root).forEach(el => renderPdfEmbed(el));
}

/* ---------- caret helpers ---------- */
function focusBlock(id, pos) {
  const el = $(`[data-blk="${id}"] .blk-text`) || $(`[data-blk="${id}"] [contenteditable="true"]`);
  if (!el) return;
  el.focus();
  setCaret(el, pos);
}
function setCaret(el, pos) {
  const r = document.createRange();
  if (pos === Infinity) { r.selectNodeContents(el); r.collapse(false); }
  else {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let left = pos, node, placed = false;
    while ((node = walker.nextNode())) {
      if (left <= node.length) { r.setStart(node, left); placed = true; break; }
      left -= node.length;
    }
    if (!placed) { r.selectNodeContents(el); r.collapse(pos === 0); }
    else r.collapse(true);
  }
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function caretOffset(el) {
  const s = getSelection();
  if (!s.rangeCount) return 0;
  const r = s.getRangeAt(0), pre = r.cloneRange();
  pre.selectNodeContents(el); pre.setEnd(r.endContainer, r.endOffset);
  return pre.toString().length;
}
const blockOf = el => curPage.blocks.find(x => x.id === el.closest('[data-blk]')?.dataset.blk);

/* ---------- typing ---------- */
const SHORTCUTS = [
  [/^###\s/, 'h3'], [/^##\s/, 'h2'], [/^#\s/, 'h1'], [/^[-*•]\s/, 'bullet'], [/^1[.)]\s/, 'num'],
  [/^\[ ?\]\s/, 'todo'], [/^>\s/, 'toggle'], [/^["”“]\s/, 'quote'], [/^!\s/, 'callout'],
];
function onBlockInput(e) {
  const t = e.target;
  const b = blockOf(t); if (!b) return;
  if (t.matches('.blk-text')) {
    const txt = t.textContent;
    if (!txt) t.innerHTML = '';
    b.html = sanitize(t.innerHTML);
    if (txt === '---' || txt === '***') { convertBlock(b, 'divider'); return; }
    if (txt === '```') { b.html = ''; convertBlock(b, 'code'); return; }
    const hit = SHORTCUTS.find(([re]) => re.test(txt));
    if (hit && !e.isComposing) {
      const len = txt.match(hit[0])[0].length;
      deleteText(t, 0, len);
      b.html = sanitize(t.innerHTML);
      convertBlock(b, hit[1]); return;
    }
    checkSlash(t, b);
  } else if (t.dataset.field === 'body') b.body = t.textContent;
  else if (t.dataset.field === 'caption') b.caption = t.textContent;
  else if (t.dataset.field === 'code') { b.text = t.textContent; highlightCode(t, true); }
  else if (t.dataset.field === 'math') { b.text = t.value; $(`[data-blk="${b.id}"] .math-view`).innerHTML = mathHtml(b.text); }
  else if (t.matches('td')) b.rows[+t.dataset.r][+t.dataset.c] = t.textContent;
  touchPage();
  if (curPage.blocks.indexOf(b) < 2) renderPageList();
  if (/^h[123]$/.test(b.type)) $$('.blk-toc').forEach(el => { const tb = blockOf(el); if (tb) rerenderBlock(tb); });
}
function convertBlock(b, type, focus = true) {
  const keep = { id: b.id, html: b.html };
  for (const k of Object.keys(b)) delete b[k];
  Object.assign(b, blk(type, keep.html), { id: keep.id });
  const i = curPage.blocks.indexOf(b);
  if (!isText(b) && !curPage.blocks[i + 1]) curPage.blocks.splice(i + 1, 0, blk('p'));
  renderBlocks(); touchPage();
  if (!focus) return;
  if (isText(b)) focusBlock(b.id, 0);
  else if (b.type === 'code') $(`[data-blk="${b.id}"] .code`)?.focus();
  else if (b.type === 'divider') focusBlock(curPage.blocks[i + 1].id, 0);
}
function insertAfter(b, nb) { curPage.blocks.splice(curPage.blocks.indexOf(b) + 1, 0, nb); return nb; }

function onBlockKey(e) {
  if (slash.open && slashKey(e)) return;
  const t = e.target, b = blockOf(t); if (!b) return;
  const bs = curPage.blocks, i = bs.indexOf(b);
  if (t.dataset.field === 'code') {
    if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
    else if (e.key === 'Enter' && !e.shiftKey && !(e.metaKey || e.ctrlKey)) { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); const nb = insertAfter(b, blk('p')); renderBlocks(); focusBlock(nb.id, 0); touchPage(); }
    return;
  }
  if (t.dataset.field === 'body' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.execCommand('insertText', false, '\n'); return; }
  if (t.matches('td') && e.key === 'Enter') { e.preventDefault(); return; }
  if (!t.matches('.blk-text')) return;
  const off = caretOffset(t), sel = getSelection(), len = t.textContent.length;
  if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
    e.preventDefault(); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); b.html = sanitize(t.innerHTML); touchPage(); return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); fmtLink(); return; }
  if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); return; }
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    if (!t.textContent && b.type !== 'p') { convertBlock(b, 'p'); return; }
    // move whatever sits after the caret into a new block
    const r = sel.getRangeAt(0).cloneRange();
    r.setEndAfter(t.lastChild || t);
    const frag = r.extractContents();
    const tmp = document.createElement('div'); tmp.appendChild(frag);
    b.html = sanitize(t.innerHTML);
    const sameType = ['bullet', 'num', 'todo', 'toggle'].includes(b.type) ? b.type : 'p';
    const nb = insertAfter(b, blk(sameType, sanitize(tmp.innerHTML)));
    renderBlocks(); focusBlock(nb.id, 0); touchPage();
  } else if (e.key === 'Backspace' && off === 0 && sel.isCollapsed) {
    if (b.type !== 'p') { e.preventDefault(); convertBlock(b, 'p'); return; }
    if (i === 0) return;
    const prev = bs[i - 1];
    e.preventDefault();
    if (!isText(prev)) {
      if (!t.textContent) { bs.splice(i, 1); renderBlocks(); touchPage(); }
      else if (prev.type === 'divider') { bs.splice(i - 1, 1); renderBlocks(); focusBlock(b.id, 0); touchPage(); }
      return;
    }
    const pos = plain(prev.html).length;
    prev.html = sanitize(prev.html + b.html); bs.splice(i, 1);
    renderBlocks(); focusBlock(prev.id, pos); touchPage();
  } else if (e.key === 'ArrowUp' && off === 0) {
    const prev = bs.slice(0, i).reverse().find(isText);
    if (prev) { e.preventDefault(); focusBlock(prev.id, Infinity); }
  } else if (e.key === 'ArrowDown' && off === len) {
    const next = bs.slice(i + 1).find(isText);
    if (next) { e.preventDefault(); focusBlock(next.id, 0); }
  }
}
function onPaste(e) {
  const t = e.target.closest('[contenteditable="true"]'); if (!t) return;
  const files = [...(e.clipboardData.files || [])];
  if (files.length && t.matches('.blk-text')) { e.preventDefault(); addFiles(blockOf(t), files); return; }
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  if (t.matches('.blk-text') && /^https?:\/\/\S+$/.test(text.trim()) && !t.textContent) {
    const b = blockOf(t); Object.assign(b, { type: 'bookmark', url: text.trim(), title: '' }); delete b.html;
    renderBlocks(); touchPage(); return;
  }
  document.execCommand('insertText', false, text);
}

/* ---------- slash menu ---------- */
const slash = { open: false, el: null, block: null, start: 0, items: [], idx: 0 };
function checkSlash(t, b) {
  const off = caretOffset(t), txt = t.textContent;
  if (!slash.open) {
    if (txt[off - 1] === '/' && (off === 1 || /\s/.test(txt[off - 2]))) openSlash(t, b, off - 1);
    return;
  }
  if (slash.block !== b || off <= slash.start) return closeSlash();
  const q = txt.slice(slash.start + 1, off);
  if (/\s{2}/.test(q) || q.length > 24) return closeSlash();
  filterSlash(q);
}
function openSlash(t, b, start) {
  closeSlash();
  Object.assign(slash, { open: true, block: b, start, idx: 0 });
  slash.el = document.createElement('div');
  slash.el.className = 'slash';
  document.body.appendChild(slash.el);
  slash.el.addEventListener('mousedown', e => e.preventDefault());
  slash.el.addEventListener('click', e => { const it = e.target.closest('[data-i]'); if (it) chooseSlash(slash.items[+it.dataset.i]); });
  filterSlash('');
  const r = getSelection().getRangeAt(0).getBoundingClientRect();
  const box = r.width || r.height ? r : t.getBoundingClientRect();
  const h = Math.min(360, innerHeight - 24);
  let top = box.bottom + 6; if (top + h > innerHeight) top = Math.max(12, box.top - h - 6);
  slash.el.style.top = top + 'px';
  slash.el.style.right = Math.max(12, innerWidth - box.right - 10) + 'px';
  slash.el.style.maxHeight = h + 'px';
}
function filterSlash(q) {
  const s = q.trim().toLowerCase();
  slash.items = SLASH.filter(x => !s || x.n.includes(s) || x.k.toLowerCase().includes(s) || x.t.startsWith(s));
  slash.idx = Math.min(slash.idx, Math.max(0, slash.items.length - 1));
  if (!slash.items.length) { slash.el.innerHTML = '<div class="slash-empty">ما فيه نتائج</div>'; return; }
  let g = '';
  slash.el.innerHTML = slash.items.map((x, i) => (x.g !== g ? `<div class="slash-g">${(g = x.g)}</div>` : '') +
    `<button class="slash-it ${i === slash.idx ? 'on' : ''}" data-i="${i}"><span class="si">${x.i}</span><span><b>${x.n}</b><small>${x.d}</small></span></button>`).join('');
  slash.el.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
}
function slashKey(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = slash.items.length; if (!n) return true;
    slash.idx = (slash.idx + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    $$('.slash-it', slash.el).forEach((el, i) => el.classList.toggle('on', i === slash.idx));
    slash.el.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
    return true;
  }
  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (slash.items[slash.idx]) chooseSlash(slash.items[slash.idx]); else closeSlash(); return true; }
  if (e.key === 'Escape') { e.preventDefault(); closeSlash(); return true; }
  return false;
}
function closeSlash() { slash.el?.remove(); Object.assign(slash, { open: false, el: null, block: null }); }
function chooseSlash(item) {
  const b = slash.block;
  const t = $(`[data-blk="${b.id}"] .blk-text`);
  // remove the "/query" text the user typed
  const end = caretOffset(t);
  deleteText(t, slash.start, end);
  b.html = sanitize(t.innerHTML);
  closeSlash();
  const empty = !plain(b.html).trim();
  applyType(b, item.t, empty);
}
function caretPoint(el, pos) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = pos, node;
  while ((node = walker.nextNode())) { if (left <= node.length) return [node, left]; left -= node.length; }
  return [el, el.childNodes.length];
}
function deleteText(el, from, to) {
  const r = document.createRange();
  r.setStart(...caretPoint(el, from)); r.setEnd(...caretPoint(el, to));
  r.deleteContents();
}
// put a new block of `type` here: reuse the current block when it is empty
function applyType(b, type, empty) {
  const target = () => empty ? b : insertAfter(b, blk('p'));
  if (TEXT_TYPES.includes(type) || ['divider', 'code', 'table', 'math', 'toc'].includes(type)) {
    const tb = target();
    convertBlock(tb, type);
    if (type === 'math') { tb.editing = true; renderBlocks(); $(`[data-blk="${tb.id}"] .math-src`)?.focus(); }
    return;
  }
  if (['image', 'video', 'audio', 'file', 'pdf'].includes(type)) return pickFiles(type, files => addFiles(b, files, type, empty));
  if (type === 'page') {
    const child = blankPage(curPage.id); state.pages.push(child);
    const tb = target(); Object.assign(tb, { type: 'page', pageId: child.id }); delete tb.html;
    save(); go('notes', { pageId: child.id }); return;
  }
  if (type === 'link-page') {
    const others = state.pages.filter(p => p.id !== curPage.id);
    if (!others.length) return toast('ما فيه صفحات ثانية بعد');
    openDialog(`<h3>رابط لصفحة</h3><div class="pick-list">${others.map(p => `<button class="side-item" value="${p.id}">${p.icon} ${esc(p.title || 'بدون عنوان')}</button>`).join('')}</div>`, (fd, v) => {
      if (!state.pages.some(p => p.id === v)) return;
      const tb = target(); Object.assign(tb, { type: 'page', pageId: v }); delete tb.html; renderBlocks(); touchPage();
    });
    return;
  }
  if (type === 'bookmark') {
    openDialog(`<h3>رابط ويب</h3><input name="url" dir="ltr" placeholder="https://…" required autofocus><input name="title" placeholder="العنوان (اختياري)">${actions(false)}`, fd => {
      let url = fd.get('url').trim(); if (!/^https?:\/\//.test(url)) url = 'https://' + url;
      const tb = target(); Object.assign(tb, { type: 'bookmark', url, title: fd.get('title').trim() }); delete tb.html; renderBlocks(); touchPage();
    });
    return;
  }
  if (type === 'drive') return linkDriveFile(b, empty);
}

/* ---------- files ---------- */
const ACCEPT = { image: 'image/*', video: 'video/*', audio: 'audio/*', pdf: 'application/pdf', file: '' };
function pickFiles(type, cb) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.multiple = type !== 'pdf'; if (ACCEPT[type]) inp.accept = ACCEPT[type];
  inp.onchange = () => { if (inp.files.length) cb([...inp.files]); };
  inp.click();
}
function kindOf(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type === 'application/pdf') return 'pdf';
  return 'file';
}
async function addFiles(b, files, forced, empty = false) {
  let at = b;
  for (const [n, f] of files.entries()) {
    const key = await putBlob(f);
    const type = forced && forced !== 'file' ? forced : forced === 'file' ? 'file' : kindOf(f);
    const nb = { id: uid(), type, blob: key, name: f.name, size: f.size, mime: f.type, caption: '' };
    if (n === 0 && empty) { const i = curPage.blocks.indexOf(at); curPage.blocks[i] = nb; } else insertAfter(at, nb);
    at = nb;
  }
  if (!curPage.blocks[curPage.blocks.indexOf(at) + 1]) insertAfter(at, blk('p'));
  renderBlocks(); touchPage();
}
async function fileBlob(b) { return store.getBlob(b.blob); }
async function saveCopy(b) {
  const blob = await fileBlob(b); if (!blob) return toast('الملف مو موجود');
  if (desktop) { const p = await desktop.saveFile({ name: b.name || 'file', bytes: new Uint8Array(await blob.arrayBuffer()) }); if (p) toast('انحفظ في: ' + p); }
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = b.name || 'file'; a.click(); }
}

/* PDF inside a note: render every page as an image (lazy) */
async function renderPdfEmbed(el) {
  const box = el.querySelector('.pdf-pages');
  try {
    const doc = await loadPdf(el.dataset.pdf);
    box.innerHTML = '';
    const w = Math.min(box.clientWidth || 680, 900);
    const io = new IntersectionObserver(entries => entries.forEach(async en => {
      if (!en.isIntersecting || en.target.dataset.done) return;
      en.target.dataset.done = 1; io.unobserve(en.target);
      const page = await doc.getPage(+en.target.dataset.n);
      const vp1 = page.getViewport({ scale: 1 });
      const sc = (w / vp1.width) * (window.devicePixelRatio || 1);
      const vp = page.getViewport({ scale: sc });
      const c = en.target.querySelector('canvas');
      c.width = vp.width; c.height = vp.height;
      // 'print' renders without requestAnimationFrame, so pages still draw while the window is in the background
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp, intent: 'print' }).promise;
    }), { rootMargin: '400px' });
    for (let n = 1; n <= doc.numPages; n++) {
      const d = document.createElement('div'); d.className = 'pdf-page'; d.dataset.n = n;
      const pg = await doc.getPage(n), vp = pg.getViewport({ scale: 1 });
      d.style.aspectRatio = `${vp.width} / ${vp.height}`;
      d.innerHTML = '<canvas></canvas>';
      box.appendChild(d); io.observe(d);
    }
  } catch (err) { console.error(err); box.innerHTML = '<span class="hint">ما قدرت أفتح ملف PDF هذا</span>'; }
}

/* ---------- code & math ---------- */
function codeHtml(text, lang) {
  if (!window.hljs || !text) return esc(text || '');
  try { return lang && lang !== 'plaintext' && hljs.getLanguage(lang) ? hljs.highlight(text, { language: lang }).value : esc(text); }
  catch { return esc(text); }
}
function highlightCode(el, keepCaret) {
  const b = blockOf(el); if (!b) return;
  const off = keepCaret ? caretOffset(el) : 0;
  el.innerHTML = codeHtml(b.text, b.lang);
  if (keepCaret) setCaret(el, off);
}
function mathHtml(src) {
  if (!src.trim()) return '<span class="hint">اضغط هنا واكتب معادلة بصيغة TeX</span>';
  if (!window.katex) return `<code dir="ltr">${esc(src)}</code>`;
  try { return katex.renderToString(src, { throwOnError: false, displayMode: true }); } catch { return `<code dir="ltr">${esc(src)}</code>`; }
}

/* ---------- formatting toolbar on text selection ---------- */
let fmtBar = null, fmtRange = null;
document.addEventListener('selectionchange', () => {
  if (ui.view !== 'notes') return;
  const s = getSelection();
  const host = s.rangeCount && s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement)?.closest('.blk-text');
  if (!host || s.isCollapsed || slash.open) return hideFmt();
  fmtRange = s.getRangeAt(0).cloneRange();
  showFmt(fmtRange.getBoundingClientRect());
});
function showFmt(rect) {
  if (!fmtBar) {
    fmtBar = document.createElement('div');
    fmtBar.className = 'fmt';
    fmtBar.innerHTML = `<button data-f="bold"><b>B</b></button><button data-f="italic"><i>I</i></button><button data-f="underline"><u>U</u></button><button data-f="strikeThrough"><s>S</s></button><button data-f="code" dir="ltr">&lt;/&gt;</button><button data-f="link">🔗</button><span class="fmt-sep"></span>${MARKS.map(c => `<button data-f="mark" data-c="${c}" class="mk mk-${c}" aria-label="تظليل"></button>`).join('')}<button data-f="unmark" title="إزالة التظليل">⌫</button>`;
    fmtBar.addEventListener('mousedown', e => e.preventDefault());
    fmtBar.addEventListener('click', e => { const btn = e.target.closest('[data-f]'); if (btn) applyFmt(btn.dataset.f, btn.dataset.c); });
    document.body.appendChild(fmtBar);
  }
  fmtBar.hidden = false;
  const w = fmtBar.offsetWidth;
  fmtBar.style.top = Math.max(8, rect.top - 44) + 'px';
  fmtBar.style.left = Math.min(innerWidth - w - 8, Math.max(8, rect.left + rect.width / 2 - w / 2)) + 'px';
}
function hideFmt() { if (fmtBar) fmtBar.hidden = true; }
function wrapSelection(tag, attrs = {}) {
  const s = getSelection(); if (!s.rangeCount) return;
  const r = s.getRangeAt(0);
  const el = document.createElement(tag);
  Object.assign(el.dataset, attrs);
  el.appendChild(r.extractContents());
  r.insertNode(el);
  s.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(el); s.addRange(nr);
}
function applyFmt(f, c) {
  const s = getSelection();
  if (fmtRange && !s.rangeCount) s.addRange(fmtRange);
  const host = (s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentElement)?.closest('.blk-text');
  if (!host) return;
  if (f === 'link') return fmtLink();
  if (f === 'code') wrapSelection('code');
  else if (f === 'mark') wrapSelection('mark', { c });
  else if (f === 'unmark') { const t = s.toString(); document.execCommand('insertText', false, t); }
  else document.execCommand(f);
  const b = blockOf(host); b.html = sanitize(host.innerHTML); touchPage();
}
function fmtLink() {
  const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return toast('حدد النص اللي تبي تحطه رابط');
  const range = s.getRangeAt(0).cloneRange();
  const host = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement).closest('.blk-text');
  openDialog(`<h3>إضافة رابط</h3><input name="url" dir="ltr" placeholder="https://…" required autofocus>${actions(false)}`, fd => {
    let url = fd.get('url').trim(); if (!/^(https?:|mailto:)/.test(url)) url = 'https://' + url;
    host.focus(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    document.execCommand('createLink', false, url);
    const b = blockOf(host); b.html = sanitize(host.innerHTML); touchPage();
  });
}
// links inside text open in the browser on Cmd/Ctrl+click (plain click edits)
document.addEventListener('click', e => {
  const a = e.target.closest('.blk-text a[href]');
  if (a && (e.metaKey || e.ctrlKey)) { e.preventDefault(); window.open(a.href, '_blank'); }
});

/* ---------- drag to reorder ---------- */
function setupDrag(box) {
  let dragId = null;
  box.addEventListener('dragstart', e => {
    const g = e.target.closest?.('.grip'); if (!g) return;
    dragId = g.closest('[data-blk]').dataset.blk;
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId);
    e.dataTransfer.setDragImage(g.closest('[data-blk]'), 20, 20);
  });
  box.addEventListener('dragover', e => {
    if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); return; }
    if (!dragId) return;
    e.preventDefault();
    const over = e.target.closest('[data-blk]');
    $$('.drop-before,.drop-after', box).forEach(x => x.classList.remove('drop-before', 'drop-after'));
    if (over && over.dataset.blk !== dragId) {
      const r = over.getBoundingClientRect();
      over.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
    }
  });
  box.addEventListener('drop', e => {
    const over = e.target.closest('[data-blk]');
    if (e.dataTransfer.files.length) {
      e.preventDefault();
      const b = over ? blockOf(over) : curPage.blocks[curPage.blocks.length - 1];
      addFiles(b, [...e.dataTransfer.files]); return;
    }
    if (!dragId) return;
    e.preventDefault();
    const before = over?.classList.contains('drop-before');
    $$('.drop-before,.drop-after', box).forEach(x => x.classList.remove('drop-before', 'drop-after'));
    if (over && over.dataset.blk !== dragId) {
      const bs = curPage.blocks, from = bs.findIndex(x => x.id === dragId), moving = bs.splice(from, 1)[0];
      let to = bs.findIndex(x => x.id === over.dataset.blk);
      if (!before) to++;
      bs.splice(to, 0, moving); renderBlocks(); touchPage();
    }
    dragId = null;
  });
  box.addEventListener('dragend', () => { dragId = null; $$('.drop-before,.drop-after', box).forEach(x => x.classList.remove('drop-before', 'drop-after')); });
}

/* ---------- block menu ---------- */
function blockMenu(b) {
  const turn = SLASH.filter(x => TEXT_TYPES.includes(x.t));
  openDialog(`<h3>خيارات الكتلة</h3>
    ${isText(b) ? `<span class="note">تحويل إلى</span><div class="turn-grid">${turn.map(x => `<button class="btn small ${x.t === b.type ? 'primary' : ''}" value="turn:${x.t}">${x.i} ${x.n}</button>`).join('')}</div>` : ''}
    <div class="row wrap"><button class="btn" value="up">↑ لفوق</button><button class="btn" value="down">↓ لتحت</button><button class="btn" value="dup">تكرار</button><button class="btn danger" value="del">حذف</button></div>
    <div class="dlg-actions"><span class="grow"></span><button class="btn" value="cancel">إغلاق</button></div>`, (fd, v) => {
    const bs = curPage.blocks, i = bs.indexOf(b);
    if (v.startsWith('turn:')) return convertBlock(b, v.slice(5));
    if (v === 'up' && i > 0) [bs[i - 1], bs[i]] = [bs[i], bs[i - 1]];
    if (v === 'down' && i < bs.length - 1) [bs[i + 1], bs[i]] = [bs[i], bs[i + 1]];
    if (v === 'dup') bs.splice(i + 1, 0, { ...structuredClone(b), id: uid() });
    if (v === 'del') { bs.splice(i, 1); if (!bs.length) bs.push(blk('p')); }
    renderBlocks(); touchPage();
  });
}

/* ---------- Google Drive (through the Drive folder on this Mac) ---------- */
async function linkDriveFile(b, empty) {
  if (!desktop) return toast('ربط درايف يشتغل في تطبيق الماك');
  const info = await desktop.folderInfo();
  if (!info.clouds.some(c => c.kind === 'google')) {
    return ask('ما لقيت قوقل درايف على هذا الماك. نزّل تطبيق «Google Drive for desktop» وسجّل دخول، وبعدها ملفات درايف تطلع هنا.', null);
  }
  const files = await desktop.pickFile({ title: 'اختر ملف من قوقل درايف', fromDrive: true, readBytes: false });
  if (!files.length) return;
  const f = files[0];
  const nb = { id: uid(), type: 'drive', path: f.path, name: f.name, size: f.size };
  if (empty) curPage.blocks[curPage.blocks.indexOf(b)] = nb; else insertAfter(b, nb);
  if (!curPage.blocks[curPage.blocks.indexOf(nb) + 1]) insertAfter(nb, blk('p'));
  renderBlocks(); touchPage();
}

/* ---------- actions ---------- */
Object.assign(A, {
  'open-page': a => { hideFmt(); go('notes', { pageId: a.dataset.page }); },
  'new-page': () => { const p = blankPage(); state.pages.push(p); save(); go('notes', { pageId: p.id, pageSearch: '' }); },
  'notes-home': () => go('notes', { pageId: 'home' }),
  'new-from-tpl': a => { const p = pageFromTemplate(a.dataset.t); state.pages.push(p); save(); go('notes', { pageId: p.id }); },
  'apply-tpl': a => { const t = pageFromTemplate(a.dataset.t); Object.assign(curPage, { icon: t.icon, title: t.title, blocks: t.blocks }); touchPage(); render(); },
  'page-fav': () => { curPage.fav = !curPage.fav; touchPage(); render(); toast(curPage.fav ? 'انضافت للمفضلة' : 'انشالت من المفضلة'); },
  'new-subpage': a => { const p = blankPage(a.dataset.page); state.pages.push(p); ui.expanded[a.dataset.page] = true; save(); go('notes', { pageId: p.id }); },
  'page-expand': a => { ui.expanded[a.dataset.page] = !ui.expanded[a.dataset.page]; renderPageList(); },
  'del-page': () => {
    const pg = curPage;
    const all = [pg.id]; for (let k = 0; k < all.length; k++) childrenOf(all[k]).forEach(c => all.push(c.id));
    ask(`تحذف «${esc(pg.title || 'بدون عنوان')}»${all.length > 1 ? ` و ${all.length - 1} صفحة فرعية` : ''}؟`, 'حذف', () => {
      state.pages = state.pages.filter(p => !all.includes(p.id)); ui.pageId = pg.parentId || 'home'; save(); render();
    });
  },
  icon: () => openDialog(`<h3>اختر أيقونة</h3><div class="emoji-grid">${ICONS.map(i => `<button value="${i}">${i}</button>`).join('')}</div>`, (fd, v) => { if (ICONS.includes(v)) { curPage.icon = v; touchPage(); render(); } }),
  cover: () => openDialog(`<h3>غلاف الصفحة</h3><div class="cover-grid">${COVERS.map((c, i) => `<button value="c${i}" style="background:${c}"></button>`).join('')}</div><button class="btn" value="upload">🖼️ ارفع صورة</button><div class="dlg-actions"><span class="grow"></span><button class="btn" value="cancel">إغلاق</button></div>`, (fd, v) => {
    if (v === 'upload') return pickFiles('image', async ([f]) => { const key = await putBlob(f); await blobUrl(key); curPage.cover = { img: key }; touchPage(); render(); });
    if (v[0] === 'c') { curPage.cover = { bg: COVERS[+v.slice(1)] }; touchPage(); render(); }
  }),
  'cover-remove': () => { curPage.cover = null; touchPage(); render(); },
  'blk-check': a => { const b = blockOf(a); b.checked = !b.checked; touchPage(); rerenderBlock(b); },
  'blk-toggle': a => { const b = blockOf(a); b.open = !b.open; touchPage(); rerenderBlock(b); },
  'blk-menu': a => blockMenu(blockOf(a)),
  'blk-add': a => { const b = blockOf(a); const nb = insertAfter(b, blk('p')); renderBlocks(); focusBlock(nb.id, 0); },
  'callout-icon': a => { const b = blockOf(a); openDialog(`<h3>أيقونة الملاحظة</h3><div class="emoji-grid">${['💡', '⚠️', '❗', '✅', '📌', '🔥', 'ℹ️', '❓', '⭐', '🎯', '📝', '🚀'].map(i => `<button value="${i}">${i}</button>`).join('')}</div>`, (fd, v) => { b.icon = v; touchPage(); rerenderBlock(b); }); },
  'code-copy': async a => { const b = blockOf(a); try { await navigator.clipboard.writeText(b.text); toast('انسخ الكود'); } catch { toast('ما قدرت أنسخ'); } },
  tbl: a => {
    const b = blockOf(a), op = a.dataset.op, cols = b.rows[0].length;
    if (op === 'row+') b.rows.push(Array(cols).fill(''));
    if (op === 'col+') b.rows.forEach(r => r.push(''));
    if (op === 'row-' && b.rows.length > 1) b.rows.pop();
    if (op === 'col-' && cols > 1) b.rows.forEach(r => r.pop());
    touchPage(); rerenderBlock(b);
  },
  'math-edit': a => { const b = blockOf(a); b.editing = !b.editing; rerenderBlock(b); if (b.editing) $(`[data-blk="${b.id}"] .math-src`)?.focus(); },
  'toc-go': a => $(`[data-blk="${a.dataset.to}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
  'file-open': async a => {
    const b = blockOf(a), blob = await fileBlob(b); if (!blob) return toast('الملف مو موجود');
    if (/^(image|video|audio)\//.test(blob.type) || blob.type === 'application/pdf' || blob.type.startsWith('text/')) window.open(URL.createObjectURL(blob), '_blank');
    else saveCopy(b);
  },
  'file-save': a => saveCopy(blockOf(a)),
  'file-drive': async a => {
    const b = blockOf(a), blob = await fileBlob(b); if (!blob) return;
    const p = await desktop.saveToDrive({ name: b.name, bytes: new Uint8Array(await blob.arrayBuffer()) });
    if (p) toast('انحفظ في درايف: Madar/Exports'); else ask('ما لقيت قوقل درايف على هذا الماك. نزّل «Google Drive for desktop» وسجّل دخول.', null);
  },
  'drive-open': async a => { const b = blockOf(a); if (!(await desktop?.fileExists(b.path))) { b.missing = true; rerenderBlock(b); return; } desktop.openFile(b.path); },
  'drive-reveal': a => desktop?.revealFile(blockOf(a).path),
  'doc-end': () => {
    const last = curPage.blocks[curPage.blocks.length - 1];
    if (last && isText(last) && !plain(last.html)) return focusBlock(last.id, 0);
    const nb = blk('p'); curPage.blocks.push(nb); renderBlocks(); focusBlock(nb.id, 0);
  },
});
document.addEventListener('change', e => {
  if (e.target.dataset.change !== 'code-lang') return;
  const b = blockOf(e.target); b.lang = e.target.value; touchPage(); rerenderBlock(b);
});
document.addEventListener('mousedown', e => { if (slash.open && !e.target.closest('.slash')) closeSlash(); });
