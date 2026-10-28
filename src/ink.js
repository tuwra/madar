'use strict';
/* ---------- notebooks & books: handwriting on paper and PDFs ---------- */

const PW = 1000; // page width in page units; height depends on the page
const pageH = pg => pg.h || 1414;
const PAPERS = { blank: 'سادة', lined: 'مسطّر', narrow: 'مسطّر ضيق', grid: 'مربعات', dots: 'نقاط', cornell: 'كورنيل', planner: 'مخطط أسبوعي', todo: 'قائمة مهام', music: 'نوتة موسيقية' };
const PAPER_COLORS = { white: ['#ffffff', '#d5dbe5', 'أبيض'], cream: ['#fbf6ea', '#e2d6bd', 'كريمي'], yellow: ['#fff7c7', '#e5d991', 'أصفر'], blue: ['#edf4ff', '#c4d5ee', 'أزرق'], green: ['#eefaf0', '#c3e2c9', 'أخضر'], dark: ['#1e2328', '#3a434c', 'داكن'] };
const PEN_STYLES = { fountain: 'قلم حبر', ball: 'قلم جاف', brush: 'فرشاة' };
const SHAPES = { line: ['خط', '╱'], arrow: ['سهم', '↗'], rect: ['مستطيل', '▭'], ellipse: ['دائرة', '◯'], triangle: ['مثلث', '△'] };
const INK_PALETTE = ['#1f2937', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#ffffff'];
const HL_PALETTE = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74'];
const TOOLS = [['pen', '✒️', 'قلم', 'P'], ['hl', '🖍️', 'تظليل', 'H'], ['eraser', '🧽', 'ممحاة', 'E'], ['lasso', '➰', 'تحديد', 'L'], ['shape', '🔷', 'أشكال', 'S'], ['text', '🔤', 'نص', 'T'], ['laser', '🔴', 'ليزر', 'K']];

const ink = {
  tool: 'pen', penStyle: 'fountain', color: INK_PALETTE[0], hl: HL_PALETTE[0], size: 3, hlSize: 4,
  eraser: 'stroke', eraserSize: 16, eraseHlOnly: false, shape: 'rect', textSize: 28,
  zoom: 1, finger: 'auto', thumbs: false, marksOnly: false,
  undo: [], redo: [], penSeen: false, sel: null,
};
try { Object.assign(ink, JSON.parse(localStorage.getItem('madar-ink') || '{}'), { undo: [], redo: [], sel: null }); } catch { /* ignore */ }
const keepInkPrefs = () => { try { const { undo, redo, sel, ...prefs } = ink; localStorage.setItem('madar-ink', JSON.stringify(prefs)); } catch { /* ignore */ } };
let inkApi = null;

/* ---------- pdf ---------- */
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
const pdfDocs = new Map();
async function loadPdf(key) {
  if (!pdfDocs.has(key)) {
    pdfDocs.set(key, (async () => {
      const blob = await store.getBlob(key);
      if (!blob) throw new Error('missing pdf');
      return pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
    })());
  }
  return pdfDocs.get(key);
}
const pdfCache = new Map();
async function pdfCanvas(key, n, px) {
  const id = `${key}:${n}:${Math.round(px)}`;
  if (pdfCache.has(id)) return pdfCache.get(id);
  const p = (async () => {
    const doc = await loadPdf(key), page = await doc.getPage(n);
    const vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: px / vp1.width });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    // 'print' renders without requestAnimationFrame, so pages still draw while the window is in the background
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp, intent: 'print' }).promise;
    return c;
  })();
  pdfCache.set(id, p);
  if (pdfCache.size > 40) pdfCache.delete(pdfCache.keys().next().value);
  return p;
}

/* ---------- images on pages ---------- */
const imgCache = new Map();
function pageImage(key, onLoad) {
  const hit = imgCache.get(key);
  if (hit instanceof ImageBitmap) return hit;
  if (!hit) {
    imgCache.set(key, 'loading');
    store.getBlob(key).then(b => b && createImageBitmap(b)).then(bm => { if (bm) { imgCache.set(key, bm); onLoad?.(); } }).catch(() => imgCache.delete(key));
  }
  return null;
}

/* ---------- drawing primitives ---------- */
function drawPaper(c, nb, pg, H) {
  const [bg, line] = PAPER_COLORS[pg.paperColor || nb.paperColor || 'white'] || PAPER_COLORS.white;
  const paper = pg.pdfPage ? 'blank' : (pg.paper || nb.paper || 'blank');
  c.fillStyle = bg; c.fillRect(0, 0, PW, H);
  c.strokeStyle = line; c.fillStyle = line; c.lineWidth = 1.3;
  const hline = (y, x0 = 40, x1 = PW - 40) => { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); };
  const vline = (x, y0, y1) => { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); };
  if (paper === 'lined' || paper === 'narrow') {
    const step = paper === 'lined' ? 44 : 32;
    for (let y = 140; y < H - 40; y += step) hline(y);
    c.strokeStyle = '#f0a8a8'; vline(PW - 110, 40, H - 40);
  } else if (paper === 'grid') {
    for (let x = 20; x <= PW; x += 40) vline(x, 0, H);
    for (let y = 27; y <= H; y += 40) hline(y, 0, PW);
  } else if (paper === 'dots') {
    for (let x = 20; x <= PW; x += 40) for (let y = 27; y <= H; y += 40) { c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); }
  } else if (paper === 'cornell') {
    for (let y = 196; y < H - 280; y += 44) hline(y, 40, PW - 300);
    c.lineWidth = 2; hline(150, 30, PW - 30); hline(H - 260, 30, PW - 30); vline(PW - 300, 150, H - 260);
  } else if (paper === 'planner') {
    c.lineWidth = 2; hline(120, 40, PW - 40);
    const top = 140, rowH = (H - 60 - top) / 7;
    c.font = '600 26px "IBM Plex Sans Arabic", sans-serif'; c.textAlign = 'right';
    for (let i = 0; i < 7; i++) {
      const y = top + i * rowH;
      c.lineWidth = 1.3; c.strokeRect(40, y, PW - 80, rowH - 12);
      c.fillText(DOW[i], PW - 58, y + 36);
    }
  } else if (paper === 'todo') {
    for (let y = 160; y < H - 60; y += 56) { hline(y + 20, 110, PW - 40); c.lineWidth = 2; c.strokeRect(PW - 96, y - 6, 26, 26); c.lineWidth = 1.3; }
  } else if (paper === 'music') {
    for (let y = 150; y < H - 120; y += 120) for (let k = 0; k < 5; k++) hline(y + k * 14);
  }
}
function drawStroke(c, s) {
  const p = s.pts; if (!p.length) return;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = s.color; c.fillStyle = s.color;
  if (s.tool === 'hl') {
    c.globalAlpha = 0.38; c.lineWidth = s.size * 5; c.lineCap = s.shape ? 'butt' : 'square';
    c.beginPath(); c.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]);
    if (p.length === 1) c.lineTo(p[0][0] + 0.1, p[0][1]);
    c.stroke();
  } else if (s.shape || s.style === 'ball') {
    c.lineWidth = s.size;
    c.beginPath(); c.moveTo(p[0][0], p[0][1]);
    if (s.shape) for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]);
    else smoothPath(c, p);
    if (p.length === 1) c.lineTo(p[0][0] + 0.1, p[0][1]);
    c.stroke();
  } else {
    const wOf = pr => s.style === 'brush' ? s.size * (0.15 + pr * 2.4) : s.size * (0.4 + pr * 1.2);
    if (p.length < 3) {
      c.beginPath(); c.arc(p[0][0], p[0][1], wOf(p[0][2]) / 2 + 0.4, 0, 7); c.fill();
      if (p.length === 2) { c.lineWidth = wOf(p[1][2]); c.beginPath(); c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); c.stroke(); }
    } else {
      let from = p[0];
      for (let i = 1; i < p.length - 1; i++) {
        const to = [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2];
        c.lineWidth = wOf(p[i][2]);
        c.beginPath(); c.moveTo(from[0], from[1]); c.quadraticCurveTo(p[i][0], p[i][1], to[0], to[1]); c.stroke();
        from = to;
      }
      const last = p[p.length - 1];
      c.beginPath(); c.moveTo(from[0], from[1]); c.lineTo(last[0], last[1]); c.stroke();
    }
  }
  c.restore();
}
function smoothPath(c, p) {
  for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
  if (p.length > 1) c.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
}
function drawImageItem(c, it, onLoad) {
  const bm = pageImage(it.blob, onLoad);
  if (bm) c.drawImage(bm, it.x, it.y, it.w, it.h);
  else { c.save(); c.fillStyle = 'rgba(148,163,184,.25)'; c.fillRect(it.x, it.y, it.w, it.h); c.restore(); }
}
function drawTextItem(c, it) {
  c.save();
  c.fillStyle = it.color; c.font = `${it.size}px "IBM Plex Sans Arabic", system-ui, sans-serif`;
  const rtl = /[؀-ۿ]/.test(it.text);
  c.textAlign = rtl ? 'right' : 'left'; c.direction = rtl ? 'rtl' : 'ltr';
  const x = rtl ? it.x + it.w : it.x;
  let y = it.y + it.size;
  for (const para of (it.text || '').split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > it.w && line) { c.fillText(line, x, y); y += it.size * 1.4; line = w; } else line = t;
    }
    c.fillText(line, x, y); y += it.size * 1.4;
  }
  c.restore();
}
// paint a whole page (used for thumbnails and export)
async function paintPage(c, nb, pg, scale) {
  const H = pageH(pg);
  c.setTransform(scale, 0, 0, scale, 0, 0);
  drawPaper(c, nb, pg, H);
  if (pg.pdfPage && nb.pdf) { try { c.drawImage(await pdfCanvas(nb.pdf, pg.pdfPage, PW * scale), 0, 0, PW, H); } catch { /* missing */ } }
  for (const it of pg.items) {
    if (it.type === 'image') {
      let bm = pageImage(it.blob);
      if (!bm) { const b = await store.getBlob(it.blob); if (b) { bm = await createImageBitmap(b); imgCache.set(it.blob, bm); } }
      if (bm) c.drawImage(bm, it.x, it.y, it.w, it.h);
    }
  }
  for (const s of pg.strokes) drawStroke(c, s);
  for (const it of pg.items) if (it.type === 'text') drawTextItem(c, it);
}

/* ---------- geometry ---------- */
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segDist(q, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(a[0] + t * dx - q[0], a[1] + t * dy - q[1]);
}
function strokeHit(s, q, r) {
  const p = s.pts;
  if (p.length === 1) return dist(p[0], q) < r;
  for (let i = 1; i < p.length; i++) if (segDist(q, p[i - 1], p[i]) < r) return true;
  return false;
}
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = dist(a, b), n = Math.floor(d / step);
    for (let k = 1; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, b[2]]);
    out.push(b);
  }
  return out;
}
function inPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], pts[0], pts[pts.length - 1]); if (d > max) { max = d; idx = i; } }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}
const ellipsePts = (cx, cy, rx, ry) => Array.from({ length: 73 }, (_, i) => [cx + rx * Math.cos(i / 72 * Math.PI * 2), cy + ry * Math.sin(i / 72 * Math.PI * 2), 0.5]);
// "draw and hold" turns a rough stroke into a clean line or shape
function recognize(raw) {
  const P = raw.map(p => [p[0], p[1], 0.5]);
  if (P.length < 4) return null;
  let L = 0; for (let i = 1; i < P.length; i++) L += dist(P[i - 1], P[i]);
  if (L < 30) return null;
  const a = P[0], z = P[P.length - 1];
  if (dist(a, z) / L > 0.9) return [a, z];
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = x1 - x0, h = y1 - y0, size = Math.max(w, h);
  if (dist(a, z) > 0.3 * size || Math.min(w, h) < 12) return null;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let err = 0; for (const p of P) err += Math.abs(Math.hypot((p[0] - cx) / (w / 2), (p[1] - cy) / (h / 2)) - 1);
  err /= P.length;
  let poly = simplify(P, size * 0.1).slice(0, -1);
  // drop vertices that sit on a straight edge (the start point usually does)
  for (let changed = true; changed && poly.length > 3;) {
    changed = false;
    for (let i = 0; i < poly.length; i++) {
      const pr = poly[(i - 1 + poly.length) % poly.length], cu = poly[i], nx = poly[(i + 1) % poly.length];
      const v1 = [cu[0] - pr[0], cu[1] - pr[1]], v2 = [nx[0] - cu[0], nx[1] - cu[1]];
      const sin = Math.abs(v1[0] * v2[1] - v1[1] * v2[0]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1);
      if (sin < 0.35 && v1[0] * v2[0] + v1[1] * v2[1] > 0) { poly.splice(i, 1); changed = true; break; }
    }
  }
  if (err < 0.13 || poly.length > 6 || poly.length < 3) return err < 0.22 ? ellipsePts(cx, cy, w / 2, h / 2) : null;
  if (poly.length === 4) {
    const axis = poly.every((p, i) => { const q = poly[(i + 1) % 4]; const ang = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0])) % (Math.PI / 2); return ang < 0.26 || ang > Math.PI / 2 - 0.26; });
    if (axis) return [[x0, y0, 0.5], [x1, y0, 0.5], [x1, y1, 0.5], [x0, y1, 0.5], [x0, y0, 0.5]];
  }
  return [...poly, poly[0]];
}
function shapePts(kind, s, e) {
  const [x0, y0] = s, [x1, y1] = e, q = (x, y) => [x, y, 0.5];
  if (kind === 'line') return [q(x0, y0), q(x1, y1)];
  if (kind === 'arrow') {
    const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.min(44, Math.hypot(x1 - x0, y1 - y0) * 0.35);
    return [q(x0, y0), q(x1, y1), q(x1 - len * Math.cos(ang - 0.5), y1 - len * Math.sin(ang - 0.5)), q(x1, y1), q(x1 - len * Math.cos(ang + 0.5), y1 - len * Math.sin(ang + 0.5))];
  }
  if (kind === 'rect') return [q(x0, y0), q(x1, y0), q(x1, y1), q(x0, y1), q(x0, y0)];
  if (kind === 'triangle') return [q((x0 + x1) / 2, y0), q(x1, y1), q(x0, y1), q((x0 + x1) / 2, y0)];
  return ellipsePts((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2);
}

/* ---------- shelf ---------- */
function renderInk() {
  const nb = state.notebooks.find(n => n.id === ui.notebookId);
  if (nb) return renderNotebook(nb);
  ui.shelfTab ||= 'all';
  const q = (ui.shelfSearch || '').trim();
  const list = state.notebooks.filter(n => (ui.shelfTab === 'all' || (ui.shelfTab === 'fav' ? n.fav : (n.kind || 'notebook') === ui.shelfTab)) && (!q || n.name.includes(q)))
    .sort((a, b) => (b.opened || 0) - (a.opened || 0));
  view.innerHTML = `<div class="wrap wide">
    <div class="page-head"><div><h1>الدفاتر والكتب</h1><div class="sub">اكتب بخط يدك، ظلّل، وعلّق على كتبك وملفات PDF.</div></div>
      <div class="row wrap">
        <button class="btn primary" data-act="new-nb">＋ دفتر جديد</button>
        <button class="btn" data-act="import-book">📕 استيراد كتاب PDF</button>
        ${desktop ? '<button class="btn" data-act="import-book-drive">△ من قوقل درايف</button>' : ''}
      </div></div>
    <div class="shelf-bar">
      <div class="tabs">${[['all', 'الكل'], ['notebook', 'الدفاتر'], ['book', 'الكتب'], ['fav', '★ المفضلة']].map(([k, v]) => `<button class="tab ${ui.shelfTab === k ? 'on' : ''}" data-act="shelf-tab" data-t="${k}">${v}</button>`).join('')}</div>
      <input type="search" id="shelf-search" placeholder="ابحث…" value="${esc(q)}">
    </div>
    <div class="shelf">
      ${list.map(n => `<div class="nb" style="--c:${n.color}">
        <button class="nb-cover ${n.cover ? 'has-img' : ''}" data-act="open-nb" data-nb="${n.id}">${n.cover ? `<img src="${n.cover}" alt="">` : `<span>${esc(n.name)}</span>`}${n.fav ? '<i class="fav">★</i>' : ''}</button>
        <div class="nb-info"><div><b>${esc(n.name)}</b><div class="nb-meta">${n.kind === 'book' ? 'كتاب' : 'دفتر'} · ${n.pages.length} صفحة</div></div><button class="btn small ghost" data-act="nb-opts" data-nb="${n.id}" aria-label="خيارات">⋯</button></div>
      </div>`).join('') || '<div class="empty" style="grid-column:1/-1">ما فيه شي هنا بعد</div>'}
    </div></div>`;
  $('#shelf-search').addEventListener('input', e => { ui.shelfSearch = e.target.value; const pos = e.target.selectionStart; renderInk(); const i = $('#shelf-search'); i.focus(); i.setSelectionRange(pos, pos); });
}
function notebookDialog(nb) {
  const n = nb || { name: '', color: COLORS[3], paper: 'lined', paperColor: 'white' };
  openDialog(`<h3>${nb ? 'خيارات ' + (nb.kind === 'book' ? 'الكتاب' : 'الدفتر') : 'دفتر جديد'}</h3>
    <input name="name" class="title-input" value="${esc(n.name)}" placeholder="الاسم" required autofocus>
    ${n.kind === 'book' ? '' : `<span class="note">قالب الورق</span>${templatePicker(n.paper, n.paperColor)}`}
    <span class="note">لون الغلاف</span>${swatches('color', n.color)}
    ${nb ? `<label class="check-row"><input type="checkbox" name="fav" ${nb.fav ? 'checked' : ''}> ★ في المفضلة</label>
      <div class="row wrap"><button class="btn" value="dup" formnovalidate>تكرار</button><button class="btn" value="pdf" formnovalidate>تصدير PDF</button></div>` : ''}
    ${actions(!!nb)}`, (fd, v) => {
    if (v === 'delete') return void setTimeout(() => ask(`تحذف «${esc(nb.name)}» بكل صفحاته؟`, 'حذف', () => {
      state.notebooks = state.notebooks.filter(x => x !== nb); if (nb.pdf) store.delBlob(nb.pdf); save(); render();
    }));
    if (v === 'dup') { state.notebooks.push({ ...structuredClone(nb), id: uid(), name: nb.name + ' (نسخة)', fav: false }); save(); render(); return; }
    if (v === 'pdf') return void exportPdf(nb);
    const data = { name: fd.get('name').trim(), color: fd.get('color') || COLORS[3] };
    if (n.kind !== 'book') Object.assign(data, { paper: fd.get('paper') || 'lined', paperColor: fd.get('paperColor') || 'white' });
    if (nb) Object.assign(nb, data, { fav: fd.get('fav') === 'on' });
    else {
      const x = { id: uid(), kind: 'notebook', ...data, created: Date.now(), pages: [{ id: uid(), strokes: [], items: [] }] };
      state.notebooks.push(x); ui.notebookId = x.id; ui.inkPage = 0;
    }
    save(); render();
  });
}
function templatePicker(paper, color) {
  return `<div class="tpl-grid">${Object.entries(PAPERS).map(([k, v]) => `<label class="tpl"><input type="radio" name="paper" value="${k}" ${k === paper ? 'checked' : ''}><span><canvas data-tpl="${k}" width="60" height="80"></canvas>${v}</span></label>`).join('')}</div>
  <div class="swatches">${Object.entries(PAPER_COLORS).map(([k, [bg, , name]]) => `<label title="${name}"><input type="radio" name="paperColor" value="${k}" ${k === (color || 'white') ? 'checked' : ''}><span style="--c:${bg}"></span></label>`).join('')}</div>`;
}
// draw the little template previews once a dialog containing them opens
new MutationObserver(() => {
  $$('canvas[data-tpl]:not([data-drawn])').forEach(cv => {
    cv.dataset.drawn = 1;
    const c = cv.getContext('2d'); c.setTransform(60 / PW, 0, 0, 60 / PW, 0, 0);
    drawPaper(c, {}, { paper: cv.dataset.tpl }, 1414);
  });
}).observe(document.getElementById('dlg'), { childList: true, subtree: true });

async function importBook(files) {
  for (const f of files) {
    // files from the Mac file picker carry their bytes; browser File objects are read here
    const bytes = f instanceof Blob ? new Uint8Array(await f.arrayBuffer()) : new Uint8Array(f.bytes);
    toast(`جاري استيراد «${f.name}»…`, 60000);
    try {
      const key = await putBlob(new Blob([bytes], { type: 'application/pdf' }), 'pdf');
      const doc = await loadPdf(key);
      const pages = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const vp = (await doc.getPage(n)).getViewport({ scale: 1 });
        pages.push({ id: uid(), pdfPage: n, h: Math.round(PW * vp.height / vp.width), strokes: [], items: [] });
        if (n % 20 === 0) toast(`جاري استيراد «${f.name}»… ${n}/${doc.numPages}`, 60000);
      }
      const coverCanvas = await pdfCanvas(key, 1, 320);
      const cover = coverCanvas.toDataURL('image/jpeg', 0.82);
      const nb = { id: uid(), kind: 'book', name: f.name.replace(/\.pdf$/i, ''), color: '#475569', pdf: key, cover, paper: 'blank', paperColor: 'white', created: Date.now(), pages };
      state.notebooks.push(nb); save();
      toast(`تمت إضافة «${nb.name}» (${pages.length} صفحة)`);
    } catch (err) { console.error(err); toast(`ما قدرت أفتح «${f.name}». تأكد إنه ملف PDF سليم.`, 4000); }
  }
  render();
}

/* ---------- export ---------- */
async function pageBlob(nb, pg, scale = 2, type = 'image/png') {
  const c = document.createElement('canvas');
  c.width = PW * scale; c.height = pageH(pg) * scale;
  await paintPage(c.getContext('2d'), nb, pg, scale);
  return new Promise(res => c.toBlob(res, type, 0.9));
}
async function exportPdf(nb) {
  if (!window.jspdf) return toast('أداة تصدير PDF مو متوفرة');
  toast('جاري تجهيز ملف PDF…', 60000);
  const { jsPDF } = window.jspdf;
  let doc = null;
  for (const [i, pg] of nb.pages.entries()) {
    const H = pageH(pg), w = 595, h = 595 * H / PW;
    const blob = await pageBlob(nb, pg, 1.6, 'image/jpeg');
    const data = new Uint8Array(await blob.arrayBuffer());
    if (!doc) doc = new jsPDF({ unit: 'pt', format: [w, h], orientation: h > w ? 'p' : 'l' });
    else doc.addPage([w, h], h > w ? 'p' : 'l');
    doc.addImage(data, 'JPEG', 0, 0, w, h);
    if (i % 10 === 9) toast(`جاري تجهيز ملف PDF… ${i + 1}/${nb.pages.length}`, 60000);
  }
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  await saveOut(nb.name + '.pdf', bytes);
}
async function saveOut(name, bytes, toDrive = false) {
  if (desktop) {
    const p = toDrive ? await desktop.saveToDrive({ name, bytes }) : await desktop.saveFile({ name, bytes });
    if (toDrive && !p) return ask('ما لقيت قوقل درايف على هذا الماك. نزّل «Google Drive for desktop» وسجّل دخول.', null);
    if (p) toast(toDrive ? 'انحفظ في قوقل درايف ← Madar/Exports' : 'انحفظ ✓');
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes])); a.download = name; a.click();
  }
}

/* ---------- the notebook editor ---------- */
function renderNotebook(nb) {
  view.classList.add('full');
  nb.opened = Date.now();
  if (ui.inkPage >= nb.pages.length) ui.inkPage = nb.pages.length - 1;
  view.innerHTML = `<div class="ink tool-${ink.tool}"><div class="ink-bar"></div>
    <div class="ink-body">
      <aside class="thumbs" ${ink.thumbs ? '' : 'hidden'}></aside>
      <div class="ink-stage"><div class="sheet-wrap"><div class="sheet">
        <canvas class="c-bg"></canvas><canvas class="c-ink"></canvas><canvas class="c-live"></canvas>
        <div class="ink-items"></div><div class="sel-layer"></div>
      </div></div></div>
    </div></div>`;
  const root = $('.ink'), stage = $('.ink-stage'), sheet = $('.sheet'), itemsBox = $('.ink-items'), selLayer = $('.sel-layer');
  const [bg, inkC, live] = $$('canvas', sheet);
  const ctx = { bg: bg.getContext('2d'), ink: inkC.getContext('2d'), live: live.getContext('2d') };
  const page = () => nb.pages[ui.inkPage];
  for (const pg of nb.pages) pg.items ||= [];
  let css = 1, bgToken = 0;

  /* layout & painting */
  function layout() {
    const r = stage.getBoundingClientRect(), H = pageH(page());
    const fit = Math.max(0.1, Math.min((r.width - 32) / PW, (r.height - 32) / H));
    css = fit * ink.zoom;
    sheet.style.width = PW * css + 'px'; sheet.style.height = H * css + 'px';
    // keep canvases under the browser's size limit when zoomed in
    const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(16e6 / (PW * H * css * css)));
    const res = css * dpr;
    for (const [k, c] of [['bg', bg], ['ink', inkC], ['live', live]]) {
      c.width = Math.round(PW * res); c.height = Math.round(H * res);
      ctx[k].setTransform(res, 0, 0, res, 0, 0);
    }
    paintBg(res); redraw(); renderItems(); renderSel();
  }
  async function paintBg(res) {
    const tok = ++bgToken, pg = page(), H = pageH(pg);
    drawPaper(ctx.bg, nb, pg, H);
    if (pg.pdfPage && nb.pdf) {
      try { const c = await pdfCanvas(nb.pdf, pg.pdfPage, PW * res); if (tok === bgToken) ctx.bg.drawImage(c, 0, 0, PW, H); }
      catch { if (tok === bgToken) toast('ما قدرت أعرض صفحة الكتاب'); }
    }
  }
  function redraw(skip) {
    const H = pageH(page());
    ctx.ink.clearRect(0, 0, PW, H);
    for (const it of page().items) if (it.type === 'image' && !skip?.has(it)) drawImageItem(ctx.ink, it, () => redraw(skip));
    for (const s of page().strokes) if (!skip?.has(s)) drawStroke(ctx.ink, s);
  }
  function renderItems() {
    itemsBox.innerHTML = page().items.filter(it => it.type === 'text').map(it =>
      `<div class="ti" dir="auto" contenteditable="${ink.tool === 'text'}" data-item="${it.id}" style="left:${it.x * css}px;top:${it.y * css}px;width:${it.w * css}px;font-size:${it.size * css}px;color:${it.color}">${esc(it.text)}</div>`).join('');
  }
  const clearLive = () => ctx.live.clearRect(0, 0, PW, pageH(page()));

  /* undo */
  const snap = () => ({ pg: page(), strokes: page().strokes.slice(), items: page().items.slice() });
  const pushUndo = s => { ink.undo.push(s || snap()); if (ink.undo.length > 120) ink.undo.shift(); ink.redo = []; };
  function restore(from, to) {
    const s = from.pop(); if (!s) return;
    to.push({ pg: s.pg, strokes: s.pg.strokes.slice(), items: s.pg.items.slice() });
    s.pg.strokes = s.strokes; s.pg.items = s.items;
    ink.sel = null; redraw(); renderItems(); renderSel(); save(); bar(); thumbs();
  }

  /* selection */
  function selBox(sel) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of sel.strokes) for (const p of s.pts) { const pad = s.tool === 'hl' ? s.size * 2.5 : s.size; x0 = Math.min(x0, p[0] - pad); y0 = Math.min(y0, p[1] - pad); x1 = Math.max(x1, p[0] + pad); y1 = Math.max(y1, p[1] + pad); }
    for (const it of sel.items) { const h = it.h || it.size * 1.6; x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y); x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + h); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function renderSel(offset) {
    const sel = ink.sel;
    if (!sel) { selLayer.innerHTML = ''; return; }
    const b = sel.box, o = offset || { dx: 0, dy: 0, k: 1 };
    const x = (b.x + o.dx) * css, y = (b.y + o.dy) * css, w = b.w * o.k * css, h = b.h * o.k * css;
    const n = sel.strokes.size + sel.items.size;
    selLayer.innerHTML = `<div class="sel-box" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><span class="sel-handle"></span></div>
      ${offset ? '' : `<div class="sel-bar" style="left:${Math.max(0, x)}px;top:${Math.max(0, y - 46)}px">
        <span class="hint">${n} محدد</span>
        ${INK_PALETTE.slice(0, 6).map(c => `<button class="sw small" style="--c:${c}" data-act="sel-color" data-c="${c}" aria-label="لون"></button>`).join('')}
        <button class="ib" data-act="sel-dup">تكرار</button><button class="ib" data-act="sel-cut">قص</button><button class="ib danger" data-act="sel-del">حذف</button></div>`}`;
  }
  function selectIn(poly) {
    const strokes = new Set(page().strokes.filter(s => s.pts.filter(p => inPoly(p, poly)).length >= s.pts.length * 0.5));
    const items = new Set(page().items.filter(it => inPoly([it.x + it.w / 2, it.y + (it.h || it.size) / 2], poly)));
    if (!strokes.size && !items.size) { ink.sel = null; renderSel(); return; }
    ink.sel = { strokes, items, box: null };
    ink.sel.box = selBox(ink.sel);
    renderSel();
  }
  function transformSel(dx, dy, k) {
    const sel = ink.sel, ax = sel.box.x, ay = sel.box.y;
    const f = (x, y) => [ax + (x - ax) * k + dx, ay + (y - ay) * k + dy];
    const pg = page(), ns = new Set(), ni = new Set();
    pg.strokes = pg.strokes.map(s => {
      if (!sel.strokes.has(s)) return s;
      const t = { ...s, size: s.size * k, pts: s.pts.map(p => [...f(p[0], p[1]).map(v => Math.round(v * 10) / 10), p[2]]) };
      ns.add(t); return t;
    });
    pg.items = pg.items.map(it => {
      if (!sel.items.has(it)) return it;
      const [x, y] = f(it.x, it.y);
      const t = { ...it, x, y, w: it.w * k, ...(it.h ? { h: it.h * k } : {}), ...(it.size ? { size: it.size * k } : {}) };
      ni.add(t); return t;
    });
    ink.sel = { strokes: ns, items: ni, box: null }; ink.sel.box = selBox(ink.sel);
  }
  function previewSel(dx, dy, k) {
    const sel = ink.sel, ax = sel.box.x, ay = sel.box.y;
    clearLive();
    ctx.live.save();
    ctx.live.translate(ax + dx, ay + dy); ctx.live.scale(k, k); ctx.live.translate(-ax, -ay);
    for (const it of sel.items) if (it.type === 'image') drawImageItem(ctx.live, it);
    for (const s of sel.strokes) drawStroke(ctx.live, s);
    ctx.live.restore();
    for (const it of sel.items) {
      const el = itemsBox.querySelector(`[data-item="${it.id}"]`);
      if (el) el.style.transform = `translate(${(ax + (it.x - ax) * k + dx - it.x) * css}px, ${(ay + (it.y - ay) * k + dy - it.y) * css}px) scale(${k})`;
    }
    renderSel({ dx, dy, k });
  }

  /* toolbar */
  function bar() {
    const t = ink.tool;
    const colorRow = (pal, cur) => `<div class="ib-group">${pal.map(c => `<button class="sw ${c === cur ? 'on' : ''}" style="--c:${c}" data-act="ink-color" data-c="${c}" aria-label="لون"></button>`).join('')}<label class="sw custom" title="لون مخصص" style="--c:${cur}"><input type="color" data-change="ink-color" value="${cur}"></label></div>`;
    const sizeRow = (sizes, cur, key) => `<div class="ib-group">${sizes.map(s => `<button class="sz ${s === cur ? 'on' : ''}" data-act="ink-size" data-k="${key}" data-s="${s}" aria-label="سماكة"><span style="width:${Math.min(22, s * 2 + 3)}px;height:${Math.min(22, s * 2 + 3)}px"></span></button>`).join('')}</div>`;
    let opts = '';
    if (t === 'pen') opts = `<div class="ib-group"><select data-change="pen-style">${Object.entries(PEN_STYLES).map(([k, v]) => `<option value="${k}" ${k === ink.penStyle ? 'selected' : ''}>${v}</option>`).join('')}</select></div>${colorRow(INK_PALETTE, ink.color)}${sizeRow([1.5, 3, 5, 8], ink.size, 'size')}`;
    if (t === 'hl') opts = colorRow(HL_PALETTE, ink.hl) + sizeRow([3, 4, 6], ink.hlSize, 'hlSize');
    if (t === 'eraser') opts = `<div class="ib-group"><button class="ib ${ink.eraser === 'stroke' ? 'on' : ''}" data-act="eraser-mode" data-m="stroke">الخط كامل</button><button class="ib ${ink.eraser === 'part' ? 'on' : ''}" data-act="eraser-mode" data-m="part">جزء منه</button></div>${ink.eraser === 'part' ? sizeRow([8, 16, 32], ink.eraserSize, 'eraserSize') : ''}<div class="ib-group"><label class="ib"><input type="checkbox" data-change="erase-hl" ${ink.eraseHlOnly ? 'checked' : ''}> التظليل فقط</label></div>`;
    if (t === 'shape') opts = `<div class="ib-group">${Object.entries(SHAPES).map(([k, [n, i]]) => `<button class="ib ${k === ink.shape ? 'on' : ''}" data-act="shape-kind" data-s="${k}" title="${n}">${i}</button>`).join('')}</div>${colorRow(INK_PALETTE, ink.color)}${sizeRow([1.5, 3, 5, 8], ink.size, 'size')}`;
    if (t === 'text') opts = `${colorRow(INK_PALETTE, ink.color)}<div class="ib-group"><select data-change="text-size">${[[20, 'صغير'], [28, 'متوسط'], [40, 'كبير'], [60, 'عنوان']].map(([v, n]) => `<option value="${v}" ${v === ink.textSize ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="hint lbl">اضغط على الصفحة واكتب</span></div>`;
    if (t === 'lasso') opts = '<div class="ib-group"><span class="hint">ارسم دائرة حول اللي تبي تحدده، بعدها اسحبه أو كبّره من الزاوية</span></div>';
    if (t === 'laser') opts = '<div class="ib-group"><span class="hint">للشرح والعرض: الأثر يختفي لحاله وما ينحفظ</span></div>';
    if (t === 'pen' || t === 'hl') opts += '<div class="ib-group"><span class="hint lbl">ارسم وثبّت لحظة = شكل مضبوط</span></div>';
    const fingerLbl = { auto: '✋ تلقائي', draw: '✋ يرسم', pan: '✋ يحرّك' }[ink.finger];
    $('.ink-bar').innerHTML = `
      <div class="ib-group"><button class="ib" data-act="ink-back">→ <span class="lbl">الرف</span></button><b class="nb-title">${esc(nb.name)}</b></div>
      <div class="ib-group">${TOOLS.map(([k, i, n, key]) => `<button class="ib ${t === k ? 'on' : ''}" data-act="ink-tool" data-tool="${k}" title="${n} (${key})">${i} <span class="lbl">${n}</span></button>`).join('')}<button class="ib" data-act="ink-image" title="إدراج صورة">🖼️ <span class="lbl">صورة</span></button></div>
      ${opts}
      <div class="ib-group"><button class="ib" data-act="ink-undo" ${ink.undo.length ? '' : 'disabled'} title="تراجع (⌘Z)">↶</button><button class="ib" data-act="ink-redo" ${ink.redo.length ? '' : 'disabled'} title="إعادة (⇧⌘Z)">↷</button></div>
      <div class="ib-group"><button class="ib" data-act="ink-zoom" data-z="-1" title="تصغير">−</button><button class="ib zoom-n" data-act="ink-zoom" data-z="0" title="ملء الشاشة">${Math.round(ink.zoom * 100)}%</button><button class="ib" data-act="ink-zoom" data-z="1" title="تكبير">＋</button><button class="ib" data-act="ink-finger" title="وش يسوي الإصبع على الشاشة">${fingerLbl}</button></div>
      <div class="ib-group">
        <button class="ib ${ink.thumbs ? 'on' : ''}" data-act="ink-thumbs" title="الصفحات">▦ <span class="lbl">الصفحات</span></button>
        <button class="ib ${page().mark ? 'on' : ''}" data-act="ink-mark" title="علامة مرجعية">${page().mark ? '★' : '☆'}</button>
        <button class="ib" data-act="ink-page" data-n="-1" ${ui.inkPage ? '' : 'disabled'} title="السابقة">›</button>
        <span class="pg-n">${ui.inkPage + 1} / ${nb.pages.length}</span>
        <button class="ib" data-act="ink-page" data-n="1" ${ui.inkPage < nb.pages.length - 1 ? '' : 'disabled'} title="التالية">‹</button>
        <button class="ib" data-act="ink-add-page" title="صفحة جديدة بعد هذي">＋ <span class="lbl">صفحة</span></button>
        <button class="ib" data-act="ink-more" title="خيارات الصفحة والدفتر">⋯</button>
      </div>`;
    root.className = `ink tool-${t}`;
    $$('.ti', itemsBox).forEach(el => el.contentEditable = t === 'text');
  }

  /* thumbnails */
  let thumbIO = null;
  function thumbs() {
    const box = $('.thumbs'); if (!box) return;
    box.hidden = !ink.thumbs;
    if (!ink.thumbs) return;
    thumbIO?.disconnect();
    const pages = nb.pages.map((pg, i) => [pg, i]).filter(([pg]) => !ink.marksOnly || pg.mark);
    box.innerHTML = `<div class="thumbs-head"><b>الصفحات</b><label class="hint"><input type="checkbox" data-change="marks-only" ${ink.marksOnly ? 'checked' : ''}> ★ فقط</label></div>
      ${pages.map(([pg, i]) => `<div class="thumb ${i === ui.inkPage ? 'on' : ''}"><button data-act="ink-goto" data-i="${i}"><canvas data-th="${i}" width="${120 * 2}" height="${Math.round(120 * 2 * pageH(pg) / PW)}"></canvas></button><span>${pg.mark ? '★ ' : ''}${i + 1}</span><button class="ib th-menu" data-act="thumb-menu" data-i="${i}" aria-label="خيارات">⋯</button></div>`).join('') || '<div class="hint" style="padding:12px">ما فيه صفحات بعلامة</div>'}`;
    thumbIO = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      thumbIO.unobserve(en.target);
      const pg = nb.pages[+en.target.dataset.th];
      paintPage(en.target.getContext('2d'), nb, pg, en.target.width / PW);
    }), { root: box, rootMargin: '300px' });
    $$('canvas[data-th]', box).forEach(c => thumbIO.observe(c));
    box.querySelector('.thumb.on')?.scrollIntoView({ block: 'nearest' });
  }
  let thumbTimer = null;
  const refreshThumb = () => {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => { const c = $(`canvas[data-th="${ui.inkPage}"]`); if (c) paintPage(c.getContext('2d'), nb, page(), c.width / PW); }, 400);
  };
  function goPage(i) {
    if (i < 0 || i >= nb.pages.length) return;
    ui.inkPage = i; ink.undo = []; ink.redo = []; ink.sel = null;
    layout(); bar(); thumbs();
  }

  /* zoom */
  let zoomPreview = null;
  function previewZoom(k, cx, cy) {
    const r = sheet.getBoundingClientRect();
    if (!zoomPreview) zoomPreview = { origin: [cx - r.left, cy - r.top], page: [(cx - r.left) / css, (cy - r.top) / css], screen: [cx, cy], zoom0: ink.zoom };
    const z = Math.max(0.5, Math.min(5, zoomPreview.zoom0 * k));
    const kk = z / zoomPreview.zoom0;
    sheet.style.transformOrigin = `${zoomPreview.origin[0]}px ${zoomPreview.origin[1]}px`;
    sheet.style.transform = `translate(${cx - zoomPreview.screen[0]}px, ${cy - zoomPreview.screen[1]}px) scale(${kk})`;
    zoomPreview.z = z; zoomPreview.screenNow = [cx, cy];
  }
  function commitZoom() {
    if (!zoomPreview) return;
    const zp = zoomPreview; zoomPreview = null;
    sheet.style.transform = ''; ink.zoom = zp.z ?? ink.zoom;
    layout(); bar(); keepInkPrefs();
    const r = sheet.getBoundingClientRect(), [sx, sy] = zp.screenNow || zp.screen;
    stage.scrollBy(r.left + zp.page[0] * css - sx, r.top + zp.page[1] * css - sy);
  }
  let wheelTimer = null;
  stage.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return; // a Mac trackpad pinch arrives as ctrl+wheel
    e.preventDefault();
    const k = zoomPreview ? (zoomPreview.z / zoomPreview.zoom0) * Math.exp(-e.deltaY * 0.01) : Math.exp(-e.deltaY * 0.01);
    previewZoom(k, e.clientX, e.clientY);
    clearTimeout(wheelTimer); wheelTimer = setTimeout(commitZoom, 180);
  }, { passive: false });

  /* input */
  const pt = e => {
    const r = sheet.getBoundingClientRect();
    const pr = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
    return [Math.round((e.clientX - r.left) / css * 10) / 10, Math.round((e.clientY - r.top) / css * 10) / 10, Math.round(pr * 100) / 100];
  };
  const touches = new Map();
  let cur = null, mode = null, gesture = null, lasso = null, start = null, erasing = null, holdTimer = null, holdAnchor = null, selDrag = null;
  const laser = { pts: [], raf: 0 };
  const fingerPans = () => ink.finger === 'pan' || (ink.finger === 'auto' && ink.penSeen);

  function abortStroke() { cur = null; mode = null; lasso = null; clearTimeout(holdTimer); clearLive(); }
  function down(e) {
    if (e.pointerType === 'pen' && !ink.penSeen) { ink.penSeen = true; bar(); }
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size >= 2) {
        abortStroke();
        const [a, b] = [...touches.values()];
        gesture = { d0: dist(a, b) || 1, mid0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], t0: Date.now(), moved: false, count: touches.size };
        return;
      }
      if (fingerPans()) { mode = 'pan'; start = [e.clientX, e.clientY]; return; }
    }
    if (e.button > 0) return;
    e.preventDefault();
    live.setPointerCapture(e.pointerId);
    const p = pt(e), t = ink.tool;
    if (ink.sel && t === 'lasso') {
      const b = ink.sel.box, hx = b.x + b.w, hy = b.y + b.h, tol = 22 / css;
      if (Math.abs(p[0] - hx) < tol && Math.abs(p[1] - hy) < tol) { mode = 'sel-scale'; selDrag = { p }; redraw(new Set([...ink.sel.strokes, ...ink.sel.items])); previewSel(0, 0, 1); return; }
      if (p[0] > b.x && p[0] < hx && p[1] > b.y && p[1] < hy) { mode = 'sel-move'; selDrag = { p }; redraw(new Set([...ink.sel.strokes, ...ink.sel.items])); previewSel(0, 0, 1); return; }
    }
    if (ink.sel) { ink.sel = null; renderSel(); }
    mode = t;
    if (t === 'pen' || t === 'hl') {
      cur = { tool: t, style: t === 'hl' ? 'hl' : ink.penStyle, color: t === 'hl' ? ink.hl : ink.color, size: t === 'hl' ? ink.hlSize : ink.size, pts: [p] };
      holdAnchor = p; armHold();
      drawStroke(ctx.live, cur);
    } else if (t === 'eraser') { erasing = { before: snap(), changed: false }; eraseAt(p); }
    else if (t === 'lasso') lasso = [p];
    else if (t === 'shape') { start = p; cur = { tool: 'pen', style: 'ball', color: ink.color, size: ink.size, shape: ink.shape, pts: [p] }; }
    else if (t === 'text') { addText(p); mode = null; }
    else if (t === 'laser') { laser.pts.push([p[0], p[1], performance.now()]); runLaser(); }
  }
  function armHold() {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      if (!cur || cur.shape || mode !== cur.tool) return;
      const r = recognize(cur.pts);
      if (!r) return;
      cur.pts = r; cur.shape = r.length === 2 ? 'line' : 'auto';
      clearLive(); drawStroke(ctx.live, cur);
    }, 550);
  }
  function move(e) {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      const prev = touches.get(e.pointerId);
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (gesture) {
        const [a, b] = [...touches.values()]; if (!b) return;
        const d = dist(a, b), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (Math.abs(d / gesture.d0 - 1) > 0.04 || dist(mid, gesture.mid0) > 12) gesture.moved = true;
        if (gesture.moved) {
          if (!zoomPreview) previewZoom(1, gesture.mid0[0], gesture.mid0[1]);
          previewZoom(d / gesture.d0, mid[0], mid[1]);
        }
        return;
      }
      if (mode === 'pan') { stage.scrollBy(prev[0] - e.clientX, prev[1] - e.clientY); return; }
    }
    if (!mode) {
      if (ink.tool === 'eraser' && e.pointerType !== 'touch') { clearLive(); eraserCursor(pt(e)); }
      return;
    }
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    const p = pt(e);
    if (mode === 'pen' || mode === 'hl') {
      if (cur.shape) { if (cur.shape === 'line') { cur.pts[1] = [p[0], p[1], 0.5]; clearLive(); drawStroke(ctx.live, cur); } return; }
      for (const ev of evs) cur.pts.push(pt(ev));
      if (dist(p, holdAnchor) > 4 / css) { holdAnchor = p; armHold(); }
      clearLive(); drawStroke(ctx.live, cur);
    } else if (mode === 'eraser') for (const ev of evs) eraseAt(pt(ev));
    else if (mode === 'lasso') {
      lasso.push(p);
      clearLive();
      const c = ctx.live; c.save(); c.setLineDash([8 / css, 6 / css]); c.strokeStyle = '#4f46e5'; c.lineWidth = 1.5 / css; c.fillStyle = 'rgba(79,70,229,.06)';
      c.beginPath(); c.moveTo(lasso[0][0], lasso[0][1]); for (const q of lasso) c.lineTo(q[0], q[1]); c.closePath(); c.fill(); c.stroke(); c.restore();
    } else if (mode === 'shape') { cur.pts = shapePts(ink.shape, start, p); clearLive(); drawStroke(ctx.live, cur); }
    else if (mode === 'laser') { for (const ev of evs) { const q = pt(ev); laser.pts.push([q[0], q[1], performance.now()]); } }
    else if (mode === 'sel-move') previewSel(p[0] - selDrag.p[0], p[1] - selDrag.p[1], 1);
    else if (mode === 'sel-scale') {
      const b = ink.sel.box;
      selDrag.k = Math.max(0.1, Math.max((p[0] - b.x) / b.w, (p[1] - b.y) / b.h));
      previewSel(0, 0, selDrag.k);
    }
  }
  function up(e) {
    if (e.pointerType === 'touch') {
      touches.delete(e.pointerId);
      if (gesture) {
        if (!touches.size) {
          if (!gesture.moved && Date.now() - gesture.t0 < 350) A[gesture.count >= 3 ? 'ink-redo' : 'ink-undo']();
          else commitZoom();
          gesture = null;
        }
        return;
      }
      if (mode === 'pan') { mode = null; return; }
    }
    clearTimeout(holdTimer);
    const m = mode; mode = null;
    if (m === 'pen' || m === 'hl' || m === 'shape') {
      if (!cur) return;
      if (m === 'shape' && cur.pts.length < 2) { cur = null; clearLive(); return; }
      pushUndo(); page().strokes.push(cur); drawStroke(ctx.ink, cur); clearLive(); cur = null;
      save(); bar(); refreshThumb();
    } else if (m === 'eraser') {
      if (erasing?.changed) { pushUndo(erasing.before); save(); bar(); refreshThumb(); }
      erasing = null; clearLive();
    } else if (m === 'lasso') { clearLive(); if (lasso.length > 3) selectIn(lasso); lasso = null; }
    else if (m === 'sel-move' || m === 'sel-scale') {
      const p = pt(e);
      pushUndo();
      if (m === 'sel-move') transformSel(p[0] - selDrag.p[0], p[1] - selDrag.p[1], 1); else transformSel(0, 0, selDrag.k || 1);
      selDrag = null; clearLive(); redraw(); renderItems(); renderSel(); save(); bar(); refreshThumb();
    }
  }
  function eraserCursor(p) {
    const r = ink.eraser === 'part' ? ink.eraserSize : 12;
    ctx.live.save(); ctx.live.strokeStyle = '#94a3b8'; ctx.live.lineWidth = 1.5 / css;
    ctx.live.beginPath(); ctx.live.arc(p[0], p[1], r, 0, 7); ctx.live.stroke(); ctx.live.restore();
  }
  function eraseAt(p) {
    const pg = page(), part = ink.eraser === 'part', r = part ? ink.eraserSize : 12;
    let changed = false;
    const out = [];
    for (const s of pg.strokes) {
      if (ink.eraseHlOnly && s.tool !== 'hl') { out.push(s); continue; }
      const reach = r + (s.tool === 'hl' ? s.size * 2.5 : s.size / 2);
      if (!strokeHit(s, p, reach)) { out.push(s); continue; }
      changed = true;
      if (!part) continue;
      const pts = densify(s.pts, 3), runs = [];
      let run = [];
      for (const q of pts) { if (dist(q, p) < reach) { if (run.length > 1) runs.push(run); run = []; } else run.push(q); }
      if (run.length > 1) runs.push(run);
      for (const pts2 of runs) out.push({ ...s, pts: pts2 });
    }
    if (changed) { pg.strokes = out; erasing.changed = true; redraw(); }
    clearLive(); eraserCursor(p);
  }
  function runLaser() {
    if (laser.raf) return;
    const tick = () => {
      const now = performance.now();
      laser.pts = laser.pts.filter(q => now - q[2] < 700);
      clearLive();
      const c = ctx.live, P = laser.pts;
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = '#ff2d55'; c.shadowBlur = 14;
      for (let i = 1; i < P.length; i++) {
        if (P[i][2] - P[i - 1][2] > 80) continue; // a new stroke
        const age = (now - P[i][2]) / 700;
        c.globalAlpha = Math.max(0, 1 - age); c.strokeStyle = '#ff2d55'; c.lineWidth = (5 - age * 3) / Math.max(0.6, css);
        c.beginPath(); c.moveTo(P[i - 1][0], P[i - 1][1]); c.lineTo(P[i][0], P[i][1]); c.stroke();
      }
      if (P.length && mode === 'laser') { const l = P[P.length - 1]; c.globalAlpha = 1; c.fillStyle = '#ff2d55'; c.beginPath(); c.arc(l[0], l[1], 5 / Math.max(0.6, css), 0, 7); c.fill(); }
      c.restore();
      laser.raf = P.length || mode === 'laser' ? requestAnimationFrame(tick) : 0;
    };
    laser.raf = requestAnimationFrame(tick);
  }

  /* text boxes */
  function addText(p) {
    const it = { id: uid(), type: 'text', x: p[0], y: p[1] - ink.textSize * 0.8, w: 420, size: ink.textSize, color: ink.color, text: '' };
    pushUndo(); page().items.push(it); renderItems();
    const el = itemsBox.querySelector(`[data-item="${it.id}"]`);
    el.focus();
  }
  itemsBox.addEventListener('input', e => {
    const el = e.target.closest('.ti'); const it = page().items.find(x => x.id === el?.dataset.item); if (!it) return;
    it.text = el.innerText.replace(/\n$/, ''); save(); refreshThumb();
  });
  itemsBox.addEventListener('focusout', e => {
    const el = e.target.closest('.ti'); const it = page().items.find(x => x.id === el?.dataset.item);
    if (it && !it.text.trim()) { page().items = page().items.filter(x => x !== it); renderItems(); save(); }
  });

  live.addEventListener('pointerdown', down);
  live.addEventListener('pointermove', move);
  live.addEventListener('pointerup', up);
  live.addEventListener('pointercancel', e => { touches.delete(e.pointerId); if (!touches.size) { gesture = null; commitZoom(); } abortStroke(); });
  live.addEventListener('pointerleave', () => { if (!mode && ink.tool === 'eraser') clearLive(); });
  live.addEventListener('touchstart', e => e.preventDefault(), { passive: false });

  const onKey = e => {
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]') || $('#dlg').open) return;
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); A[e.shiftKey ? 'ink-redo' : 'ink-undo'](); return; }
    if ((e.metaKey || e.ctrlKey) && (k === '=' || k === '+' || k === '-' || k === '0')) { e.preventDefault(); A['ink-zoom']({ dataset: { z: k === '-' ? -1 : k === '0' ? 0 : 1 } }); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((k === 'backspace' || k === 'delete') && ink.sel) { e.preventDefault(); A['sel-del'](); return; }
    if (k === 'escape' && ink.sel) { ink.sel = null; renderSel(); return; }
    const tool = TOOLS.find(x => x[3].toLowerCase() === k);
    if (tool) { ink.tool = tool[0]; ink.sel = null; renderSel(); bar(); keepInkPrefs(); }
    if (k === 'arrowleft') goPage(ui.inkPage + 1);
    if (k === 'arrowright') goPage(ui.inkPage - 1);
  };
  document.addEventListener('keydown', onKey);
  const ro = new ResizeObserver(() => { if (!zoomPreview) layout(); });
  ro.observe(stage);
  inkApi = { nb, page, layout, redraw, renderItems, renderSel, bar, thumbs, goPage, pushUndo, restore, refreshThumb };
  cleanup = () => { ro.disconnect(); thumbIO?.disconnect(); cancelAnimationFrame(laser.raf); document.removeEventListener('keydown', onKey); inkApi = null; ink.sel = null; };
  bar(); thumbs();
}

/* ---------- page menus ---------- */
function pageDialog(nb, i) {
  const pg = nb.pages[i];
  openDialog(`<h3>الصفحة ${i + 1}</h3>
    ${pg.pdfPage ? '<p class="note">صفحة من الكتاب</p>' : `<span class="note">قالب الورق</span>${templatePicker(pg.paper || nb.paper, pg.paperColor || nb.paperColor)}
      <label class="check-row"><input type="checkbox" name="all"> طبّق القالب على كل صفحات الدفتر</label>`}
    <div class="row wrap">
      <button class="btn" value="dup" formnovalidate>تكرار الصفحة</button>
      <button class="btn" value="up" formnovalidate ${i ? '' : 'disabled'}>↑ نقل قبل</button>
      <button class="btn" value="down" formnovalidate ${i < nb.pages.length - 1 ? '' : 'disabled'}>↓ نقل بعد</button>
      <button class="btn" value="clear" formnovalidate>مسح الكتابة</button>
    </div>
    <div class="row wrap">
      <button class="btn" value="png" formnovalidate>حفظ كصورة</button>
      ${desktop ? '<button class="btn" value="drive" formnovalidate>△ حفظ في درايف</button>' : ''}
      <button class="btn" value="pdf" formnovalidate>تصدير الدفتر PDF</button>
    </div>
    <div class="dlg-actions">${pg.pdfPage ? '' : '<button class="btn primary" value="save">حفظ</button>'}<button class="btn" value="cancel" formnovalidate>إغلاق</button><span class="grow"></span><button class="btn danger" value="delete" formnovalidate ${nb.pages.length > 1 ? '' : 'disabled'}>حذف الصفحة</button></div>`, async (fd, v) => {
    const api = inkApi;
    if (v === 'save') {
      const patch = { paper: fd.get('paper'), paperColor: fd.get('paperColor') };
      if (fd.get('all') === 'on') { Object.assign(nb, patch); nb.pages.forEach(p => { delete p.paper; delete p.paperColor; }); } else Object.assign(pg, patch);
    }
    if (v === 'dup') { nb.pages.splice(i + 1, 0, { ...structuredClone(pg), id: uid(), mark: false }); ui.inkPage = i + 1; }
    if (v === 'up' || v === 'down') { const j = v === 'up' ? i - 1 : i + 1; [nb.pages[i], nb.pages[j]] = [nb.pages[j], nb.pages[i]]; ui.inkPage = j; }
    if (v === 'clear') { api?.pushUndo(); pg.strokes = []; pg.items = []; }
    if (v === 'delete') return void setTimeout(() => ask(`تحذف الصفحة ${i + 1}؟`, 'حذف', () => { nb.pages.splice(i, 1); ui.inkPage = Math.min(ui.inkPage, nb.pages.length - 1); save(); api?.goPage(ui.inkPage); }));
    if (v === 'png' || v === 'drive') { const b = await pageBlob(nb, pg); return saveOut(`${nb.name}-${i + 1}.png`, new Uint8Array(await b.arrayBuffer()), v === 'drive'); }
    if (v === 'pdf') return exportPdf(nb);
    save();
    if (api) { ink.undo = []; ink.redo = []; api.layout(); api.bar(); api.thumbs(); }
  });
}

/* ---------- actions ---------- */
function setColor(c) {
  if (ink.tool === 'hl') ink.hl = c; else ink.color = c;
  keepInkPrefs(); inkApi?.bar();
}
Object.assign(A, {
  'open-nb': a => { ui.notebookId = a.dataset.nb; ui.inkPage = 0; ink.undo = []; ink.redo = []; ink.zoom = 1; render(); },
  'new-nb': () => notebookDialog(null),
  'nb-opts': a => notebookDialog(state.notebooks.find(n => n.id === a.dataset.nb)),
  'shelf-tab': a => { ui.shelfTab = a.dataset.t; render(); },
  'import-book': () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf'; inp.multiple = true;
    inp.onchange = () => inp.files.length && importBook([...inp.files]);
    inp.click();
  },
  'import-book-drive': async () => {
    const info = await desktop.folderInfo();
    if (!info.clouds.some(c => c.kind === 'google')) return ask('ما لقيت قوقل درايف على هذا الماك. نزّل تطبيق «Google Drive for desktop» وسجّل دخول، وبعدها كتبك اللي في درايف تطلع هنا.', null);
    const files = await desktop.pickFile({ title: 'اختر كتاب PDF من قوقل درايف', fromDrive: true, multiple: true, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (files.length) importBook(files);
  },
  'ink-back': () => { ui.notebookId = null; render(); },
  'ink-tool': a => { ink.tool = a.dataset.tool; ink.sel = null; inkApi.renderSel(); inkApi.bar(); keepInkPrefs(); },
  'ink-color': a => setColor(a.dataset.c),
  'ink-size': a => { ink[a.dataset.k] = +a.dataset.s; keepInkPrefs(); inkApi.bar(); },
  'eraser-mode': a => { ink.eraser = a.dataset.m; keepInkPrefs(); inkApi.bar(); },
  'shape-kind': a => { ink.shape = a.dataset.s; keepInkPrefs(); inkApi.bar(); },
  'ink-undo': () => inkApi && inkApi.restore(ink.undo, ink.redo),
  'ink-redo': () => inkApi && inkApi.restore(ink.redo, ink.undo),
  'ink-zoom': a => {
    const z = +a.dataset.z;
    ink.zoom = z === 0 ? 1 : Math.max(0.5, Math.min(5, ink.zoom * (z > 0 ? 1.25 : 0.8)));
    keepInkPrefs(); inkApi?.layout(); inkApi?.bar();
  },
  'ink-finger': () => { ink.finger = { auto: 'draw', draw: 'pan', pan: 'auto' }[ink.finger]; keepInkPrefs(); inkApi.bar(); toast({ auto: 'الإصبع يرسم، وإذا استخدمت القلم يصير يحرّك الصفحة', draw: 'الإصبع يرسم دائمًا', pan: 'الإصبع يحرّك الصفحة فقط' }[ink.finger]); },
  'ink-thumbs': () => { ink.thumbs = !ink.thumbs; keepInkPrefs(); inkApi.bar(); inkApi.thumbs(); inkApi.layout(); },
  'ink-mark': () => { const pg = inkApi.page(); pg.mark = !pg.mark; save(); inkApi.bar(); inkApi.thumbs(); },
  'ink-page': a => inkApi.goPage(ui.inkPage + +a.dataset.n),
  'ink-goto': a => inkApi.goPage(+a.dataset.i),
  'ink-add-page': () => {
    const nb = inkApi.nb, cur = inkApi.page();
    nb.pages.splice(ui.inkPage + 1, 0, { id: uid(), strokes: [], items: [], ...(cur.pdfPage ? {} : { paper: cur.paper, paperColor: cur.paperColor }) });
    save(); inkApi.goPage(ui.inkPage + 1);
  },
  'ink-more': () => pageDialog(inkApi.nb, ui.inkPage),
  'thumb-menu': a => pageDialog(inkApi.nb, +a.dataset.i),
  'ink-image': () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f || !inkApi) return;
      const key = await putBlob(f), bm = await createImageBitmap(f); imgCache.set(key, bm);
      const w = Math.min(560, bm.width), h = w * bm.height / bm.width, H = pageH(inkApi.page());
      const it = { id: uid(), type: 'image', blob: key, x: (PW - w) / 2, y: Math.max(40, (H - h) / 2), w, h };
      inkApi.pushUndo(); inkApi.page().items.push(it);
      ink.tool = 'lasso'; ink.sel = { strokes: new Set(), items: new Set([it]), box: { x: it.x, y: it.y, w, h } };
      save(); inkApi.redraw(); inkApi.renderSel(); inkApi.bar(); inkApi.refreshThumb();
    };
    inp.click();
  },
  'sel-del': () => {
    const s = ink.sel; if (!s || !inkApi) return;
    const pg = inkApi.page(); inkApi.pushUndo();
    pg.strokes = pg.strokes.filter(x => !s.strokes.has(x)); pg.items = pg.items.filter(x => !s.items.has(x));
    ink.sel = null; save(); inkApi.redraw(); inkApi.renderItems(); inkApi.renderSel(); inkApi.bar(); inkApi.refreshThumb();
  },
  'sel-cut': () => {
    const s = ink.sel; if (!s) return;
    ink.clip = { strokes: [...s.strokes], items: [...s.items] };
    A['sel-del'](); toast('انقص. اضغط ⌘V للصق');
  },
  'sel-dup': () => {
    const s = ink.sel; if (!s || !inkApi) return;
    const pg = inkApi.page(); inkApi.pushUndo();
    const move = p => [p[0] + 30, p[1] + 30, p[2]];
    const ns = [...s.strokes].map(x => ({ ...x, pts: x.pts.map(move) })), ni = [...s.items].map(x => ({ ...x, id: uid(), x: x.x + 30, y: x.y + 30 }));
    pg.strokes.push(...ns); pg.items.push(...ni);
    ink.sel = { strokes: new Set(ns), items: new Set(ni), box: { ...s.box, x: s.box.x + 30, y: s.box.y + 30 } };
    save(); inkApi.redraw(); inkApi.renderItems(); inkApi.renderSel(); inkApi.bar(); inkApi.refreshThumb();
  },
  'sel-color': a => {
    const s = ink.sel; if (!s || !inkApi) return;
    const pg = inkApi.page(), c = a.dataset.c; inkApi.pushUndo();
    const ns = new Set(), ni = new Set();
    pg.strokes = pg.strokes.map(x => { if (!s.strokes.has(x)) return x; const t = { ...x, color: c }; ns.add(t); return t; });
    pg.items = pg.items.map(x => { if (!s.items.has(x) || x.type !== 'text') { if (s.items.has(x)) ni.add(x); return x; } const t = { ...x, color: c }; ni.add(t); return t; });
    ink.sel = { strokes: ns, items: ni, box: s.box };
    save(); inkApi.redraw(); inkApi.renderItems(); inkApi.renderSel(); inkApi.refreshThumb();
  },
});
document.addEventListener('keydown', e => {
  if (!inkApi || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'v' || !ink.clip || e.target.closest?.('[contenteditable="true"],input,textarea')) return;
  e.preventDefault();
  const pg = inkApi.page(); inkApi.pushUndo();
  const ns = ink.clip.strokes.map(x => ({ ...x })), ni = ink.clip.items.map(x => ({ ...x, id: uid() }));
  pg.strokes.push(...ns); pg.items.push(...ni);
  ink.tool = 'lasso'; ink.sel = { strokes: new Set(ns), items: new Set(ni), box: null };
  const all = [...ns.flatMap(s => s.pts), ...ni.map(i => [i.x, i.y]), ...ni.map(i => [i.x + i.w, i.y + (i.h || i.size)])];
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  ink.sel.box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  save(); inkApi.redraw(); inkApi.renderItems(); inkApi.renderSel(); inkApi.bar();
});
document.addEventListener('change', e => {
  const k = e.target.dataset.change;
  if (k === 'ink-color') setColor(e.target.value);
  else if (k === 'pen-style') { ink.penStyle = e.target.value; keepInkPrefs(); }
  else if (k === 'erase-hl') { ink.eraseHlOnly = e.target.checked; keepInkPrefs(); }
  else if (k === 'text-size') { ink.textSize = +e.target.value; keepInkPrefs(); }
  else if (k === 'marks-only') { ink.marksOnly = e.target.checked; inkApi?.thumbs(); }
});
