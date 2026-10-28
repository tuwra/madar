'use strict';
/* ---------- notebooks & books: handwriting on paper and PDFs ---------- */

const PEN_STYLES = { fountain: 'قلم حبر', ball: 'قلم جاف', brush: 'فرشاة' };
const SHAPES = { line: 'خط', arrow: 'سهم', rect: 'مستطيل', ellipse: 'دائرة', triangle: 'مثلث' };
const TOOLS = [['pen', 'قلم', 'P'], ['hl', 'قلم تظليل', 'H'], ['eraser', 'ممحاة', 'E'], ['lasso', 'تحديد', 'L'], ['shape', 'أشكال', 'S'], ['text', 'نص', 'T'], ['image', 'صورة', 'I'], ['laser', 'مؤشر ليزر', 'K']];

const ink = {
  tool: 'pen', penStyle: 'fountain',
  colors: { pen: ['#1f2937', '#2563eb', '#dc2626'], hl: ['#fde047', '#86efac', '#93c5fd'] },
  colorIdx: { pen: 0, hl: 0 },
  sizes: { pen: [1.5, 3, 5.5], hl: [3, 4.5, 7], eraser: [8, 18, 36] }, sizeIdx: { pen: 1, hl: 1, eraser: 1 },
  eraser: 'stroke', eraseHlOnly: false, shape: 'rect', textSize: 28,
  zoom: 1, finger: 'auto', thumbs: false, marksOnly: false,
  undo: [], redo: [], penSeen: false, sel: null,
};
try {
  const saved = JSON.parse(localStorage.getItem('madar-ink2') || '{}');
  for (const k of ['tool', 'penStyle', 'colors', 'colorIdx', 'sizes', 'sizeIdx', 'eraser', 'eraseHlOnly', 'shape', 'textSize', 'finger', 'thumbs']) if (saved[k] !== undefined) ink[k] = saved[k];
  if (ink.tool === 'image') ink.tool = 'pen';
} catch { /* ignore */ }
const keepInkPrefs = () => { try { const { undo, redo, sel, clip, ...prefs } = ink; localStorage.setItem('madar-ink2', JSON.stringify(prefs)); } catch { /* ignore */ } };
const toolKind = t => (t === 'shape' || t === 'text') ? 'pen' : t;
const curColor = (t = ink.tool) => { const k = toolKind(t); return ink.colors[k]?.[ink.colorIdx[k]] ?? '#1f2937'; };
const curSize = (t = ink.tool) => { const k = toolKind(t); return ink.sizes[k]?.[ink.sizeIdx[k]] ?? 3; };
let inkApi = null;

/* line icons, drawn in the style of the rest of the app */
const ICON = {
  back: '<path d="M9 5l7 7-7 7"/>',
  pen: '<path d="M4.5 19.5l1-4.2L16 4.8a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.7 18.5z"/><path d="M14.5 6.5l3 3"/>',
  hl: '<path d="M8.5 13.5l7-7 4 4-7 7H8.5z"/><path d="M8.5 13.5L5 17v2h4l3.5-1.5"/><path d="M4 21h16" opacity=".5"/>',
  eraser: '<path d="M7.5 19.5h12"/><path d="M4.9 14.9l8.6-8.6a2 2 0 0 1 2.8 0l2.4 2.4a2 2 0 0 1 0 2.8l-7.7 7.7a2 2 0 0 1-1.4.6H9.4a2 2 0 0 1-1.4-.6l-3.1-3.1a.9.9 0 0 1 0-1.2z"/><path d="M9 10.8l4.6 4.6"/>',
  lasso: '<ellipse cx="12" cy="9.5" rx="8" ry="5.5" stroke-dasharray="3 2.6"/><path d="M7.5 13.8c-1.2 1.6-.4 3.4 1.6 3.4 1.6 0 2.2 1.6.9 3.3"/>',
  shape: '<rect x="3.5" y="10.5" width="9" height="9" rx="1.5"/><circle cx="16" cy="8" r="4.5"/>',
  text: '<path d="M5 7V5h14v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.7"/><path d="M20.5 15.5l-4.5-4.5-9 8.5"/>',
  laser: '<circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="6.5" opacity=".45"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" opacity=".45"/>',
  undo: '<path d="M9.5 14.5L5 10l4.5-4.5"/><path d="M5 10h9.5a4.5 4.5 0 0 1 0 9H12"/>',
  redo: '<path d="M14.5 14.5L19 10l-4.5-4.5"/><path d="M19 10H9.5a4.5 4.5 0 0 0 0 9H12"/>',
  pages: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  mark: '<path d="M7 4.5h10v15l-5-3.6-5 3.6z"/>',
  markOn: '<path d="M7 4.5h10v15l-5-3.6-5 3.6z" fill="currentColor"/>',
  addPage: '<path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13.5 3.5V9H19"/><path d="M12 12v5M9.5 14.5h5"/>',
  more: '<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.9-2.5L3.8 14a1.5 1.5 0 0 1 2.4-1.8L8 14.5"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5"/>',
  fountain: '<path d="M12 3l4.5 7.5L12 21l-4.5-10.5z"/><path d="M12 10.5V14"/><circle cx="12" cy="10" r=".8" fill="currentColor"/>',
  ball: '<path d="M9.5 3h5v11l-2.5 6.5L9.5 14z"/><path d="M9.5 14h5"/>',
  brush: '<path d="M14 4l6 6-6.5 6.5-6-6z"/><path d="M7.5 10.5c-2.5.5-3.5 3-3.5 5.5 0 1.6-.8 2.6-1.5 3 3.5 1.2 8.5.4 9.5-3.5"/>',
  eraseStroke: '<path d="M3 14c3-6 5 4 8-1s5 3 7-1"/><path d="M4 20L20 4" opacity=".6"/>',
  erasePart: '<path d="M3 14c3-6 5 4 8-1"/><path d="M15 12c1.5 2 3 2.5 6 0"/><circle cx="13" cy="12.5" r="3" stroke-dasharray="2 1.6"/>',
  eraseHl: '<path d="M8.5 13.5l7-7 4 4-7 7H8.5z"/><path d="M4 20L20 4" opacity=".6"/>',
  line: '<path d="M5 19L19 5"/>',
  arrow: '<path d="M5 19L19 5"/><path d="M10 5h9v9"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>',
  triangle: '<path d="M12 4.5l8.5 15h-17z"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  cut: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8.2 8.3L20 18M8.2 15.7L20 6"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
};
const ic = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

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


/* ---------- painting whole pages ---------- */
// PDF pages are rendered straight into the target canvas at its real pixel size, so text stays sharp
async function renderPdfPage(c, nb, pg, pxW, sig) {
  const doc = await loadPdf(nb.pdf), page = await doc.getPage(pg.pdfPage);
  const vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: pxW / vp1.width });
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  // 'print' renders without requestAnimationFrame, so pages still draw while the window is in the background
  const task = page.render({ canvasContext: c, viewport: vp, intent: 'print' });
  if (sig) sig.cancel = () => task.cancel();
  try { await task.promise; } finally { c.restore(); }
}
async function paintPage(c, nb, pg, scale) {
  c.setTransform(scale, 0, 0, scale, 0, 0);
  drawPaper(c, nb, pg);
  if (pg.pdfPage && nb.pdf) { try { await renderPdfPage(c, nb, pg, pageW(pg) * scale); } catch { /* missing */ } }
  for (const it of pg.items) {
    if (it.type !== 'image') continue;
    let bm = pageImage(it.blob);
    if (!bm) { const b = await store.getBlob(it.blob); if (b) { bm = await createImageBitmap(b); imgCache.set(it.blob, bm); } }
    if (bm) c.drawImage(bm, it.x, it.y, it.w, it.h);
  }
  for (const s of pg.strokes) drawStroke(c, s);
  for (const it of pg.items) if (it.type === 'text') drawTextItem(c, it);
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
    <div class="page-head"><div><h1>الدفاتر والكتب</h1><div class="sub">اكتب بخط يدك، خطط ليومك، وعلّق على كتبك وملفات PDF.</div></div>
      <div class="row wrap">
        <button class="btn primary" data-act="new-nb">دفتر جديد</button>
        <button class="btn" data-act="import-book">استيراد PDF</button>
        ${desktop ? '<button class="btn" data-act="import-book-drive">من قوقل درايف</button>' : ''}
      </div></div>
    <div class="shelf-bar">
      <div class="tabs">${[['all', 'الكل'], ['notebook', 'الدفاتر'], ['book', 'الكتب'], ['fav', 'المفضلة']].map(([k, v]) => `<button class="tab ${ui.shelfTab === k ? 'on' : ''}" data-act="shelf-tab" data-t="${k}">${v}</button>`).join('')}</div>
      <input type="search" id="shelf-search" placeholder="ابحث…" value="${esc(q)}">
    </div>
    <div class="shelf">
      ${list.map(n => {
        const p0 = n.pages[0] || {}, land = pageW(p0) > pageH(p0);
        return `<div class="nb ${land ? 'land' : ''}" style="--c:${n.color}">
        <button class="nb-cover ${n.cover ? 'has-img' : ''}" data-act="open-nb" data-nb="${n.id}" style="aspect-ratio:${pageW(p0)} / ${pageH(p0)}">${n.cover ? `<img src="${n.cover}" alt="">` : `<span>${esc(n.name)}</span>`}${n.fav ? `<i class="fav">${ic('markOn')}</i>` : ''}</button>
        <div class="nb-info"><div><b>${esc(n.name)}</b><div class="nb-meta">${n.kind === 'book' ? 'كتاب' : n.planner ? 'مخطط' : 'دفتر'} · ${n.pages.length} صفحة</div></div><button class="tb small" data-act="nb-opts" data-nb="${n.id}" aria-label="خيارات">${ic('more')}</button></div>
      </div>`;
      }).join('') || '<div class="empty" style="grid-column:1/-1">ما فيه شي هنا بعد</div>'}
    </div></div>`;
  $('#shelf-search').addEventListener('input', e => { ui.shelfSearch = e.target.value; const pos = e.target.selectionStart; renderInk(); const i = $('#shelf-search'); i.focus(); i.setSelectionRange(pos, pos); });
}

function templatePicker(paper, color) {
  const group = g => Object.entries(PAPERS).filter(([, [, gg]]) => gg === g).map(([k, [v]]) => `<label class="tpl"><input type="radio" name="paper" value="${k}" ${k === paper ? 'checked' : ''}><span><canvas data-tpl="${k}" width="120" height="170"></canvas>${v}</span></label>`).join('');
  return `<span class="note">أساسية</span><div class="tpl-grid">${group('basic')}</div>
    <span class="note">مخططات</span><div class="tpl-grid">${group('planner')}</div>
    <span class="note">لون الورق</span><div class="swatches">${Object.entries(PAPER_COLORS).map(([k, [bg, , name]]) => `<label title="${name}"><input type="radio" name="paperColor" value="${k}" ${k === (color || 'white') ? 'checked' : ''}><span style="--c:${bg}"></span></label>`).join('')}</div>`;
}
const sizePicker = (size = 'a4', land = false) => `<div class="row wrap">
  <label>المقاس<select name="size">${Object.entries(PAPER_SIZES).map(([k, [n]]) => `<option value="${k}" ${k === size ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <label>الاتجاه<span class="seg"><label><input type="radio" name="orient" value="p" ${land ? '' : 'checked'}><span class="o-p" title="عمودي"></span></label><label><input type="radio" name="orient" value="l" ${land ? 'checked' : ''}><span class="o-l" title="بالعرض"></span></label></span></label>
</div>`;
// draw the template previews whenever a dialog showing them opens
new MutationObserver(() => {
  $$('canvas[data-tpl]:not([data-drawn])').forEach(cv => {
    cv.dataset.drawn = 1;
    const c = cv.getContext('2d'); c.setTransform(cv.width / 1000, 0, 0, cv.width / 1000, 0, 0);
    drawPaper(c, { color: '#4f46e5' }, { paper: cv.dataset.tpl, w: 1000, h: 1414 });
  });
}).observe(document.getElementById('dlg'), { childList: true, subtree: true });

function notebookDialog(nb) {
  if (!nb) {
    openDialog(`<h3>دفتر جديد</h3>
      <input name="name" class="title-input" placeholder="اسم الدفتر" required autofocus>
      <div class="kind-grid">
        <label><input type="radio" name="preset" value="plain" checked><span><b>دفتر</b><small>صفحات بالقالب اللي تختاره</small></span></label>
        <label><input type="radio" name="preset" value="year"><span><b>مخطط ${new Date().getFullYear()}</b><small>أهداف، وشهور، وأسابيع، ومتتبع عادات لكل شهر</small></span></label>
        <label><input type="radio" name="preset" value="month"><span><b>مخطط يومي للشهر</b><small>صفحة شهرية وصفحة لكل يوم</small></span></label>
      </div>
      ${sizePicker()}
      ${templatePicker('lined', 'white')}
      <span class="note">لون الغلاف</span>${swatches('color', COLORS[3])}
      ${actions(false)}`, fd => {
      const size = fd.get('size'), land = fd.get('orient') === 'l', preset = fd.get('preset'), paper = fd.get('paper') || 'lined';
      const dims = pageDims(size, land);
      const pages = preset === 'plain' ? [{ id: uid(), strokes: [], items: [], ...dims, paper, tpl: tplInit(paper) }] : plannerPages(preset, size, land);
      const x = { id: uid(), kind: 'notebook', planner: preset !== 'plain', name: fd.get('name').trim(), color: fd.get('color') || COLORS[3], paper, paperColor: fd.get('paperColor') || 'white', size, created: Date.now(), pages };
      state.notebooks.push(x); ui.notebookId = x.id; ui.inkPage = 0;
      save(); render();
    });
    return;
  }
  openDialog(`<h3>${nb.kind === 'book' ? 'خيارات الكتاب' : 'خيارات الدفتر'}</h3>
    <input name="name" class="title-input" value="${esc(nb.name)}" required>
    <span class="note">لون الغلاف</span>${swatches('color', nb.color)}
    <label class="check-row"><input type="checkbox" name="fav" ${nb.fav ? 'checked' : ''}> في المفضلة</label>
    <div class="row wrap"><button class="btn" value="dup" formnovalidate>تكرار</button><button class="btn" value="pdf" formnovalidate>تصدير PDF</button></div>
    ${actions(true)}`, (fd, v) => {
    if (v === 'delete') return void setTimeout(() => ask(`تحذف «${esc(nb.name)}» بكل صفحاته؟`, 'حذف', () => {
      state.notebooks = state.notebooks.filter(x => x !== nb); if (nb.pdf) store.delBlob(nb.pdf); save(); render();
    }));
    if (v === 'dup') { state.notebooks.push({ ...structuredClone(nb), id: uid(), name: nb.name + ' (نسخة)', fav: false }); save(); render(); return; }
    if (v === 'pdf') return void exportPdf(nb);
    Object.assign(nb, { name: fd.get('name').trim(), color: fd.get('color') || nb.color, fav: fd.get('fav') === 'on' });
    save(); render();
  });
}

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
        const k = 1000 / Math.min(vp.width, vp.height);
        pages.push({ id: uid(), pdfPage: n, w: Math.round(vp.width * k), h: Math.round(vp.height * k), strokes: [], items: [] });
        if (n % 25 === 0) toast(`جاري استيراد «${f.name}»… ${n}/${doc.numPages}`, 60000);
      }
      const nb = { id: uid(), kind: 'book', name: f.name.replace(/\.pdf$/i, ''), color: '#475569', pdf: key, paper: 'blank', paperColor: 'white', created: Date.now(), pages };
      const cv = document.createElement('canvas'); cv.width = 360; cv.height = Math.round(360 * pageH(pages[0]) / pageW(pages[0]));
      await paintPage(cv.getContext('2d'), nb, pages[0], 360 / pageW(pages[0]));
      nb.cover = cv.toDataURL('image/jpeg', 0.85);
      state.notebooks.push(nb); save();
      toast(`تمت إضافة «${nb.name}» (${pages.length} صفحة)`);
    } catch (err) { console.error(err); toast(`ما قدرت أفتح «${f.name}». تأكد إنه ملف PDF سليم.`, 4000); }
  }
  render();
}

/* ---------- export ---------- */
async function pageBlob(nb, pg, scale = 2, type = 'image/png') {
  const c = document.createElement('canvas');
  c.width = Math.round(pageW(pg) * scale); c.height = Math.round(pageH(pg) * scale);
  await paintPage(c.getContext('2d'), nb, pg, scale);
  return new Promise(res => c.toBlob(res, type, 0.92));
}
async function exportPdf(nb) {
  if (!window.jspdf) return toast('أداة تصدير PDF مو متوفرة');
  toast('جاري تجهيز ملف PDF…', 60000);
  const { jsPDF } = window.jspdf;
  let doc = null;
  for (const [i, pg] of nb.pages.entries()) {
    const w = pageW(pg) * 0.595, h = pageH(pg) * 0.595, o = w > h ? 'l' : 'p';
    const blob = await pageBlob(nb, pg, 2, 'image/jpeg');
    const data = new Uint8Array(await blob.arrayBuffer());
    if (!doc) doc = new jsPDF({ unit: 'pt', format: [w, h], orientation: o }); else doc.addPage([w, h], o);
    doc.addImage(data, 'JPEG', 0, 0, w, h);
    if (i % 10 === 9) toast(`جاري تجهيز ملف PDF… ${i + 1}/${nb.pages.length}`, 60000);
  }
  await saveOut(nb.name + '.pdf', new Uint8Array(doc.output('arraybuffer')));
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

/* ---------- the notebook editor: pages stacked vertically, scroll between them ---------- */
function renderNotebook(nb) {
  view.classList.add('full');
  nb.opened = Date.now();
  for (const pg of nb.pages) { pg.items ||= []; pg.strokes ||= []; pg.w ||= 1000; pg.h ||= 1414; }
  if (ui.inkPage >= nb.pages.length) ui.inkPage = nb.pages.length - 1;
  view.innerHTML = `<div class="ink"><div class="ink-bar"></div>
    <div class="ink-body"><div class="ink-stage"><div class="pages-col"></div></div><aside class="thumbs" hidden></aside></div>
    <div class="ink-float"><button class="tb small" data-act="ink-zoom" data-z="-1" title="تصغير">${ic('zoomOut')}</button><button class="zoom-n" data-act="ink-zoom" data-z="0" title="رجوع للحجم الأصلي"></button><button class="tb small" data-act="ink-zoom" data-z="1" title="تكبير">${ic('zoomIn')}</button><span class="tb-sep"></span><span class="pg-n"></span></div>
    <div class="ink-pop" hidden></div></div>`;
  const root = $('.ink'), stage = $('.ink-stage'), col = $('.pages-col'), pop = $('.ink-pop');
  let scale = 1, shells = [], io = null;
  const V = new Map(); // page object -> mounted view
  const curPg = () => nb.pages[ui.inkPage];

  /* sizing */
  function computeScale() {
    const maxW = Math.max(...nb.pages.map(pageW));
    const fit = Math.min((stage.clientWidth - 72) / maxW, 1.1);
    scale = Math.max(0.12, fit * ink.zoom);
  }
  function sizeShells() {
    nb.pages.forEach((pg, i) => { const s = shells[i]; s.style.width = pageW(pg) * scale + 'px'; s.style.height = pageH(pg) * scale + 'px'; });
  }
  function buildShells() {
    io?.disconnect();
    for (const v of V.values()) v.sig?.cancel?.();
    V.clear();
    col.innerHTML = nb.pages.map((_, i) => `<div class="pg" data-i="${i}"></div>`).join('');
    shells = [...col.children];
    computeScale(); sizeShells();
    io = new IntersectionObserver(es => {
      for (const en of es) { const i = +en.target.dataset.i; if (en.isIntersecting) mount(i); else unmount(i); }
    }, { root: stage, rootMargin: '150% 0px' });
    shells.forEach(s => io.observe(s));
  }
  function mount(i) {
    const pg = nb.pages[i]; if (!pg || V.has(pg)) return;
    const el = shells[i];
    el.innerHTML = '<canvas class="c-bg"></canvas><canvas class="c-ink"></canvas><canvas class="c-live"></canvas><div class="ink-items"></div><div class="sel-layer"></div>';
    const [bg, inkC, live] = el.querySelectorAll('canvas');
    const v = { pg, el, cv: { bg, ink: inkC, live }, ctx: { bg: bg.getContext('2d'), ink: inkC.getContext('2d'), live: live.getContext('2d') }, items: el.querySelector('.ink-items'), selL: el.querySelector('.sel-layer'), tok: 0 };
    V.set(pg, v); paint(v);
  }
  function unmount(i) {
    const pg = nb.pages[i], v = V.get(pg); if (!v || v === act) return;
    v.sig?.cancel?.(); v.el.innerHTML = ''; V.delete(pg);
  }
  const indexOf = pg => nb.pages.indexOf(pg);
  function paint(v) {
    const W = pageW(v.pg), H = pageH(v.pg);
    const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(16e6 / (W * H * scale * scale)));
    v.res = scale * dpr;
    for (const k of ['bg', 'ink', 'live']) {
      v.cv[k].width = Math.round(W * v.res); v.cv[k].height = Math.round(H * v.res);
      v.ctx[k].setTransform(v.res, 0, 0, v.res, 0, 0);
    }
    paintBg(v); drawInk(v); renderItems(v); renderSel(v);
  }
  async function paintBg(v) {
    const tok = ++v.tok;
    v.sig?.cancel?.();
    drawPaper(v.ctx.bg, nb, v.pg);
    if (v.pg.pdfPage && nb.pdf) {
      const sig = {}; v.sig = sig;
      try { await renderPdfPage(v.ctx.bg, nb, v.pg, pageW(v.pg) * v.res, sig); }
      catch (e) { if (tok === v.tok && e?.name !== 'RenderingCancelledException') console.warn(e); }
    }
  }
  function drawInk(v, skip) {
    const c = v.ctx.ink;
    c.clearRect(0, 0, pageW(v.pg), pageH(v.pg));
    for (const it of v.pg.items) if (it.type === 'image' && !skip?.has(it)) drawImageItem(c, it, () => drawInk(v, skip));
    for (const s of v.pg.strokes) if (!skip?.has(s)) drawStroke(c, s);
  }
  function renderItems(v) {
    v.items.innerHTML = v.pg.items.filter(it => it.type === 'text').map(it =>
      `<div class="ti" dir="auto" contenteditable="${ink.tool === 'text'}" data-item="${it.id}" style="left:${it.x * scale}px;top:${it.y * scale}px;width:${it.w * scale}px;font-size:${it.size * scale}px;color:${it.color}">${esc(it.text)}</div>`).join('');
  }
  const clearLive = v => v.ctx.live.clearRect(0, 0, pageW(v.pg), pageH(v.pg));
  const repaintPg = pg => { const v = V.get(pg); if (v) { drawInk(v); renderItems(v); renderSel(v); } };

  /* zoom (trackpad pinch arrives as ctrl+wheel) */
  let zp = null, wheelTimer = null;
  function anchorAt(cx, cy) {
    for (const [i, s] of shells.entries()) {
      const r = s.getBoundingClientRect();
      if (cy >= r.top - 16 && cy <= r.bottom + 16) return { i, x: (cx - r.left) / scale, y: (cy - r.top) / scale };
    }
    return null;
  }
  function zoomPreview(k, cx, cy) {
    if (!zp) { const r = col.getBoundingClientRect(); zp = { ox: cx - r.left, oy: cy - r.top, sx: cx, sy: cy, z0: ink.zoom, k: 1, anchor: anchorAt(cx, cy) }; }
    zp.z = Math.max(0.4, Math.min(5, zp.z0 * k)); zp.cx = cx; zp.cy = cy;
    col.style.transformOrigin = `${zp.ox}px ${zp.oy}px`;
    col.style.transform = `translate(${cx - zp.sx}px, ${cy - zp.sy}px) scale(${zp.z / zp.z0})`;
  }
  function commitZoom() {
    if (!zp) return;
    const z = zp; zp = null;
    col.style.transform = ''; col.style.transformOrigin = '';
    setZoom(z.z ?? ink.zoom, z.anchor, z.cx ?? z.sx, z.cy ?? z.sy);
  }
  function setZoom(z, anchor, cx, cy) {
    ink.zoom = z; computeScale(); sizeShells();
    if (anchor) { const r = shells[anchor.i].getBoundingClientRect(); stage.scrollBy(r.left + anchor.x * scale - cx, r.top + anchor.y * scale - cy); }
    for (const v of V.values()) paint(v);
    floatBar(); keepInkPrefs();
  }
  function zoomBy(dir) {
    const r = stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const z = dir === 0 ? 1 : Math.max(0.4, Math.min(5, ink.zoom * (dir > 0 ? 1.25 : 0.8)));
    setZoom(z, anchorAt(cx, cy), cx, cy);
  }
  stage.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const prevK = zp ? zp.z / zp.z0 : 1;
    zoomPreview(prevK * Math.exp(-e.deltaY * 0.012), e.clientX, e.clientY);
    clearTimeout(wheelTimer); wheelTimer = setTimeout(commitZoom, 160);
  }, { passive: false });

  /* scrolling and the current page */
  let scrollRaf = 0;
  stage.addEventListener('scroll', () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; updateCurrent(); }); });
  function updateCurrent() {
    const sr = stage.getBoundingClientRect(), mid = sr.top + sr.height * 0.4;
    let best = ui.inkPage, bd = Infinity;
    shells.forEach((s, i) => { const r = s.getBoundingClientRect(); const d = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0; if (d < bd) { bd = d; best = i; } });
    if (best !== ui.inkPage) { ui.inkPage = best; floatBar(); bar(); markThumb(); }
  }
  function scrollToPage(i, smooth = true) {
    if (!shells[i]) return;
    ui.inkPage = i;
    const r = shells[i].getBoundingClientRect(), sr = stage.getBoundingClientRect();
    stage.scrollBy({ top: r.top - sr.top - 20, behavior: smooth ? 'smooth' : 'instant' });
    floatBar(); bar(); markThumb();
  }
  function floatBar() {
    $('.zoom-n', root).textContent = Math.round(ink.zoom * 100) + '%';
    $('.pg-n', root).textContent = `${ui.inkPage + 1} / ${nb.pages.length}`;
  }

  /* undo */
  const snap = pg => ({ pg, strokes: pg.strokes.slice(), items: pg.items.slice() });
  const pushUndo = s => { ink.undo.push(s.pg ? s : snap(s)); if (ink.undo.length > 150) ink.undo.shift(); ink.redo = []; };
  function restore(from, to) {
    const s = from.pop(); if (!s) return;
    to.push(snap(s.pg));
    s.pg.strokes = s.strokes; s.pg.items = s.items;
    ink.sel = null; repaintPg(s.pg); save(); bar(); refreshThumb(s.pg);
    if (!V.has(s.pg) && indexOf(s.pg) >= 0) scrollToPage(indexOf(s.pg));
  }

  /* selection */
  function selBox(sel) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of sel.strokes) for (const p of s.pts) { const pad = s.tool === 'hl' ? s.size * 2.5 : s.size; x0 = Math.min(x0, p[0] - pad); y0 = Math.min(y0, p[1] - pad); x1 = Math.max(x1, p[0] + pad); y1 = Math.max(y1, p[1] + pad); }
    for (const it of sel.items) { const h = it.h || it.size * 1.6; x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y); x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + h); }
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }
  function renderSel(v, o) {
    const sel = ink.sel;
    if (!sel || sel.pg !== v.pg) { v.selL.innerHTML = ''; return; }
    const b = sel.box; o ||= { dx: 0, dy: 0, k: 1 };
    const x = (b.x + o.dx) * scale, y = (b.y + o.dy) * scale, w = b.w * o.k * scale, h = b.h * o.k * scale;
    const colors = ink.colors.pen;
    v.selL.innerHTML = `<div class="sel-box" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><span class="sel-handle"></span></div>
      ${o.moving ? '' : `<div class="sel-bar" style="left:${Math.max(0, x)}px;top:${Math.max(-6, y - 50)}px">
        ${colors.map(c => `<button class="cslot small" style="--c:${c}" data-act="sel-color" data-c="${c}" aria-label="لون"></button>`).join('')}
        <span class="tb-sep"></span>
        <button class="tb small" data-act="sel-dup" title="تكرار">${ic('dup')}</button><button class="tb small" data-act="sel-cut" title="قص">${ic('cut')}</button><button class="tb small danger" data-act="sel-del" title="حذف">${ic('trash')}</button></div>`}`;
  }
  function selectIn(v, poly) {
    const strokes = new Set(v.pg.strokes.filter(s => s.pts.filter(p => inPoly(p, poly)).length >= s.pts.length * 0.5));
    const items = new Set(v.pg.items.filter(it => inPoly([it.x + it.w / 2, it.y + (it.h || it.size) / 2], poly)));
    ink.sel = strokes.size || items.size ? { pg: v.pg, strokes, items } : null;
    if (ink.sel) ink.sel.box = selBox(ink.sel);
    renderSel(v);
  }
  function transformSel(dx, dy, k) {
    const sel = ink.sel, pg = sel.pg, ax = sel.box.x, ay = sel.box.y;
    const f = (x, y) => [Math.round((ax + (x - ax) * k + dx) * 10) / 10, Math.round((ay + (y - ay) * k + dy) * 10) / 10];
    const ns = new Set(), ni = new Set();
    pg.strokes = pg.strokes.map(s => { if (!sel.strokes.has(s)) return s; const t = { ...s, size: s.size * k, pts: s.pts.map(p => [...f(p[0], p[1]), p[2]]) }; ns.add(t); return t; });
    pg.items = pg.items.map(it => {
      if (!sel.items.has(it)) return it;
      const [x, y] = f(it.x, it.y);
      const t = { ...it, x, y, w: it.w * k, ...(it.h ? { h: it.h * k } : {}), ...(it.size ? { size: it.size * k } : {}) };
      ni.add(t); return t;
    });
    ink.sel = { pg, strokes: ns, items: ni }; ink.sel.box = selBox(ink.sel);
  }
  function previewSel(v, dx, dy, k) {
    const sel = ink.sel, ax = sel.box.x, ay = sel.box.y, c = v.ctx.live;
    clearLive(v);
    c.save(); c.translate(ax + dx, ay + dy); c.scale(k, k); c.translate(-ax, -ay);
    for (const it of sel.items) if (it.type === 'image') drawImageItem(c, it);
    for (const s of sel.strokes) drawStroke(c, s);
    c.restore();
    for (const it of sel.items) {
      const el = v.items.querySelector(`[data-item="${it.id}"]`);
      if (el) { el.style.transformOrigin = '0 0'; el.style.transform = `translate(${(ax + (it.x - ax) * k + dx - it.x) * scale}px, ${(ay + (it.y - ay) * k + dy - it.y) * scale}px) scale(${k})`; }
    }
    renderSel(v, { dx, dy, k, moving: true });
  }

  /* toolbar */
  function bar() {
    const t = ink.tool, k = toolKind(t);
    let opts = '';
    if (['pen', 'hl', 'shape', 'text'].includes(t)) {
      opts += ink.colors[k].map((c, i) => `<button class="cslot ${i === ink.colorIdx[k] ? 'on' : ''}" style="--c:${c}" data-act="ink-cslot" data-i="${i}" title="${i === ink.colorIdx[k] ? 'اضغط مرة ثانية عشان تغيّر اللون' : 'لون'}"></button>`).join('');
    }
    const sk = t === 'shape' ? 'pen' : t;
    if (['pen', 'hl', 'shape'].includes(t) || (t === 'eraser' && ink.eraser === 'part')) {
      opts += (opts ? '<span class="tb-sep"></span>' : '') + ink.sizes[sk].map((s, i) => `<button class="sslot ${i === ink.sizeIdx[sk] ? 'on' : ''}" data-act="ink-sslot" data-i="${i}" title="السماكة"><span style="width:${5 + i * 4}px;height:${5 + i * 4}px"></span></button>`).join('');
    }
    const pg = curPg();
    $('.ink-bar').innerHTML = `
      <div class="tb-side"><button class="tb" data-act="ink-back" title="الرف">${ic('back')}</button><span class="nb-title">${esc(nb.name)}</span></div>
      <div class="tb-tools">
        ${TOOLS.map(([key, n, sc]) => `<button class="tb ${t === key ? 'on' : ''}" data-act="ink-tool" data-tool="${key}" title="${n} (${sc})">${ic(key === 'shape' ? (ink.shape || 'shape') : key === 'pen' ? (ink.penStyle === 'fountain' ? 'pen' : ink.penStyle) : key)}</button>`).join('')}
        ${opts ? `<span class="tb-sep"></span>${opts}` : ''}
      </div>
      <div class="tb-side end">
        <button class="tb" data-act="ink-undo" ${ink.undo.length ? '' : 'disabled'} title="تراجع (⌘Z)">${ic('undo')}</button>
        <button class="tb" data-act="ink-redo" ${ink.redo.length ? '' : 'disabled'} title="إعادة (⇧⌘Z)">${ic('redo')}</button>
        <span class="tb-sep"></span>
        <button class="tb ${pg?.mark ? 'on' : ''}" data-act="ink-mark" title="علامة مرجعية">${ic(pg?.mark ? 'markOn' : 'mark')}</button>
        <button class="tb ${ink.thumbs ? 'on' : ''}" data-act="ink-thumbs" title="الصفحات">${ic('pages')}</button>
        <button class="tb" data-act="ink-add-page" title="صفحة جديدة بعد هذي">${ic('addPage')}</button>
        <button class="tb" data-act="ink-more" title="المزيد">${ic('more')}</button>
      </div>`;
    root.className = `ink tool-${t} ${fingerPans() ? 'finger-pan' : ''}`;
    for (const v of V.values()) $$('.ti', v.items).forEach(el => { el.contentEditable = t === 'text'; });
  }
  function openPop(btn) {
    const t = ink.tool;
    let html = '';
    if (t === 'pen') html = Object.entries(PEN_STYLES).map(([k, n]) => `<button class="tb ${ink.penStyle === k ? 'on' : ''}" data-act="pen-style" data-s="${k}" title="${n}">${ic(k === 'fountain' ? 'fountain' : k)}</button>`).join('');
    if (t === 'eraser') html = `<button class="tb ${ink.eraser === 'stroke' ? 'on' : ''}" data-act="eraser-mode" data-m="stroke" title="يمسح الخط كامل">${ic('eraseStroke')}</button><button class="tb ${ink.eraser === 'part' ? 'on' : ''}" data-act="eraser-mode" data-m="part" title="يمسح الجزء اللي تمر عليه">${ic('erasePart')}</button><span class="tb-sep"></span><button class="tb ${ink.eraseHlOnly ? 'on' : ''}" data-act="erase-hl" title="يمسح التظليل فقط">${ic('eraseHl')}</button>`;
    if (t === 'shape') html = Object.entries(SHAPES).map(([k, n]) => `<button class="tb ${ink.shape === k ? 'on' : ''}" data-act="shape-kind" data-s="${k}" title="${n}">${ic(k)}</button>`).join('');
    if (t === 'text') html = [[20, 14], [28, 17], [40, 21], [60, 26]].map(([v, px]) => `<button class="tb ${ink.textSize === v ? 'on' : ''}" data-act="text-size" data-s="${v}" title="حجم الخط"><span style="font-size:${px}px;font-weight:600">ع</span></button>`).join('');
    if (t === 'laser' || t === 'lasso' || t === 'hl' || t === 'image') return;
    pop.innerHTML = html; pop.hidden = false;
    const r = btn.getBoundingClientRect(), rr = root.getBoundingClientRect();
    pop.style.top = (r.bottom - rr.top + 6) + 'px';
    pop.style.left = Math.max(8, r.left - rr.left + r.width / 2 - pop.offsetWidth / 2) + 'px';
  }
  const closePop = () => { pop.hidden = true; };
  root.addEventListener('pointerdown', e => { if (!pop.hidden && !e.target.closest('.ink-pop') && !e.target.closest('[data-act="ink-tool"]')) closePop(); }, true);

  /* thumbnails */
  let thumbIO = null;
  function thumbs() {
    const box = $('.thumbs', root);
    box.hidden = !ink.thumbs;
    thumbIO?.disconnect();
    if (!ink.thumbs) return;
    const pages = nb.pages.map((pg, i) => [pg, i]).filter(([pg]) => !ink.marksOnly || pg.mark);
    box.innerHTML = `<div class="thumbs-head"><b>الصفحات</b><button class="tb small ${ink.marksOnly ? 'on' : ''}" data-act="marks-only" title="المحفوظة بعلامة فقط">${ic(ink.marksOnly ? 'markOn' : 'mark')}</button></div>
      ${pages.map(([pg, i]) => `<div class="thumb ${i === ui.inkPage ? 'on' : ''}" data-ti="${i}"><button data-act="ink-goto" data-i="${i}"><canvas data-th="${i}" width="${Math.round(pageW(pg) * 0.26)}" height="${Math.round(pageH(pg) * 0.26)}"></canvas></button><span>${i + 1}</span>${pg.mark ? `<i class="th-mark">${ic('markOn')}</i>` : ''}<button class="tb small th-menu" data-act="thumb-menu" data-i="${i}" aria-label="خيارات">${ic('more')}</button></div>`).join('') || '<div class="hint" style="padding:12px">ما فيه صفحات بعلامة</div>'}`;
    thumbIO = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      thumbIO.unobserve(en.target);
      const pg = nb.pages[+en.target.dataset.th];
      paintPage(en.target.getContext('2d'), nb, pg, en.target.width / pageW(pg));
    }), { root: box, rootMargin: '400px' });
    $$('canvas[data-th]', box).forEach(c => thumbIO.observe(c));
    markThumb();
  }
  function markThumb() {
    const box = $('.thumbs', root); if (box.hidden) return;
    $$('.thumb', box).forEach(t => t.classList.toggle('on', +t.dataset.ti === ui.inkPage));
    box.querySelector('.thumb.on')?.scrollIntoView({ block: 'nearest' });
  }
  const thumbTimers = new Map();
  function refreshThumb(pg) {
    clearTimeout(thumbTimers.get(pg));
    thumbTimers.set(pg, setTimeout(() => {
      const i = indexOf(pg), c = $(`canvas[data-th="${i}"]`, root);
      if (c) paintPage(c.getContext('2d'), nb, pg, c.width / pageW(pg));
    }, 500));
  }

  /* input */
  const fingerPans = () => ink.finger === 'pan' || (ink.finger === 'auto' && ink.penSeen);
  const pt = (e, v) => {
    const r = v.el.getBoundingClientRect();
    const pr = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
    return [Math.round((e.clientX - r.left) / scale * 10) / 10, Math.round((e.clientY - r.top) / scale * 10) / 10, Math.round(pr * 100) / 100];
  };
  const touches = new Map();
  let act = null, cur = null, mode = null, gesture = null, lasso = null, start = null, erasing = null, holdTimer = null, holdAnchor = null, selDrag = null;
  const laser = { pts: [], raf: 0, v: null };

  function abortStroke() { if (act) clearLive(act); cur = null; mode = null; lasso = null; clearTimeout(holdTimer); }
  function down(e) {
    if (e.target.closest('.sel-bar') || (ink.tool === 'text' && e.target.closest('.ti'))) return;
    if (e.pointerType === 'pen' && !ink.penSeen) { ink.penSeen = true; bar(); }
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size >= 2) {
        abortStroke();
        const [a, b] = [...touches.values()];
        gesture = { d0: dist(a, b) || 1, mid0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], last: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], t0: Date.now(), moved: false, count: touches.size };
        return;
      }
      if (fingerPans()) return; // the page scrolls natively
    }
    if (e.button > 0) return;
    const shell = e.target.closest('.pg'); if (!shell) { if (ink.sel) { const v = V.get(ink.sel.pg); ink.sel = null; if (v) renderSel(v); } return; }
    const v = V.get(nb.pages[+shell.dataset.i]); if (!v) return;
    e.preventDefault();
    col.setPointerCapture(e.pointerId);
    act = v;
    const i = indexOf(v.pg);
    if (i !== ui.inkPage) { ui.inkPage = i; floatBar(); bar(); markThumb(); }
    const p = pt(e, v), t = ink.tool;
    if (ink.sel && ink.sel.pg === v.pg && t === 'lasso') {
      const b = ink.sel.box, hx = b.x + b.w, hy = b.y + b.h, tol = 22 / scale;
      const hit = Math.abs(p[0] - hx) < tol && Math.abs(p[1] - hy) < tol ? 'sel-scale' : (p[0] > b.x && p[0] < hx && p[1] > b.y && p[1] < hy ? 'sel-move' : null);
      if (hit) { mode = hit; selDrag = { p, k: 1 }; drawInk(v, new Set([...ink.sel.strokes, ...ink.sel.items])); previewSel(v, 0, 0, 1); return; }
    }
    if (ink.sel) { const sv = V.get(ink.sel.pg); ink.sel = null; if (sv) renderSel(sv); }
    mode = t;
    if (t === 'pen' || t === 'hl') {
      cur = { tool: t, style: t === 'hl' ? 'hl' : ink.penStyle, color: curColor(), size: curSize(), pts: [p] };
      holdAnchor = p; armHold();
      drawStroke(v.ctx.live, cur);
    } else if (t === 'eraser') { erasing = { before: snap(v.pg), changed: false }; eraseAt(v, p); }
    else if (t === 'lasso') lasso = [p];
    else if (t === 'shape') { start = p; cur = { tool: 'pen', style: 'ball', color: curColor(), size: curSize(), shape: ink.shape, pts: [p] }; }
    else if (t === 'text') { addText(v, p); mode = null; }
    else if (t === 'laser') { laser.v = v; laser.pts.push([p[0], p[1], performance.now()]); runLaser(); }
  }
  function armHold() {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      if (!cur || cur.shape || !act || (mode !== 'pen' && mode !== 'hl')) return;
      const r = recognize(cur.pts);
      if (!r) return;
      cur.pts = r; cur.shape = r.length === 2 ? 'line' : 'auto';
      clearLive(act); drawStroke(act.ctx.live, cur);
    }, 550);
  }
  function move(e) {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (gesture) {
        const [a, b] = [...touches.values()]; if (!b) return;
        const d = dist(a, b), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (Math.abs(d / gesture.d0 - 1) > 0.05 || dist(mid, gesture.mid0) > 12) gesture.moved = true;
        if (gesture.moved) {
          if (Math.abs(d / gesture.d0 - 1) > 0.05 || zp) zoomPreview(d / gesture.d0, mid[0], mid[1]);
          else { stage.scrollBy(gesture.last[0] - mid[0], gesture.last[1] - mid[1]); }
        }
        gesture.last = mid;
        return;
      }
    }
    if (!mode || !act) {
      if (ink.tool === 'eraser' && e.pointerType !== 'touch') {
        const shell = e.target.closest?.('.pg'), v = shell && V.get(nb.pages[+shell.dataset.i]);
        for (const w of V.values()) if (w !== v) clearLive(w);
        if (v) { clearLive(v); eraserCursor(v, pt(e, v)); }
      }
      return;
    }
    const v = act, evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    const p = pt(e, v);
    if (mode === 'pen' || mode === 'hl') {
      if (cur.shape) { if (cur.shape === 'line') { cur.pts[1] = [p[0], p[1], 0.5]; clearLive(v); drawStroke(v.ctx.live, cur); } return; }
      for (const ev of evs) cur.pts.push(pt(ev, v));
      if (dist(p, holdAnchor) > 4 / scale) { holdAnchor = p; armHold(); }
      clearLive(v); drawStroke(v.ctx.live, cur);
    } else if (mode === 'eraser') for (const ev of evs) eraseAt(v, pt(ev, v));
    else if (mode === 'lasso') {
      lasso.push(p);
      clearLive(v);
      const c = v.ctx.live; c.save(); c.setLineDash([8 / scale, 6 / scale]); c.strokeStyle = '#4f46e5'; c.lineWidth = 1.5 / scale; c.fillStyle = 'rgba(79,70,229,.06)';
      c.beginPath(); c.moveTo(lasso[0][0], lasso[0][1]); for (const q of lasso) c.lineTo(q[0], q[1]); c.closePath(); c.fill(); c.stroke(); c.restore();
    } else if (mode === 'shape') { cur.pts = shapePts(ink.shape, start, p); clearLive(v); drawStroke(v.ctx.live, cur); }
    else if (mode === 'laser') for (const ev of evs) { const q = pt(ev, v); laser.pts.push([q[0], q[1], performance.now()]); }
    else if (mode === 'sel-move') previewSel(v, p[0] - selDrag.p[0], p[1] - selDrag.p[1], 1);
    else if (mode === 'sel-scale') { const b = ink.sel.box; selDrag.k = Math.max(0.1, Math.max((p[0] - b.x) / b.w, (p[1] - b.y) / b.h)); previewSel(v, 0, 0, selDrag.k); }
  }
  function up(e) {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.delete(e.pointerId);
      if (gesture) {
        if (!touches.size) {
          if (!gesture.moved && Date.now() - gesture.t0 < 350) A[gesture.count >= 3 ? 'ink-redo' : 'ink-undo']();
          else commitZoom();
          gesture = null;
        }
        return;
      }
    }
    clearTimeout(holdTimer);
    const m = mode, v = act; mode = null;
    if (!v) return;
    if (m === 'pen' || m === 'hl' || m === 'shape') {
      if (cur && !(m === 'shape' && cur.pts.length < 2)) { pushUndo(v.pg); v.pg.strokes.push(cur); drawStroke(v.ctx.ink, cur); save(); bar(); refreshThumb(v.pg); }
      cur = null; clearLive(v);
    } else if (m === 'eraser') {
      if (erasing?.changed) { pushUndo(erasing.before); save(); bar(); refreshThumb(v.pg); }
      erasing = null; clearLive(v);
    } else if (m === 'lasso') { clearLive(v); if (lasso.length > 3) selectIn(v, lasso); lasso = null; }
    else if (m === 'sel-move' || m === 'sel-scale') {
      const p = pt(e, v);
      pushUndo(v.pg);
      if (m === 'sel-move') transformSel(p[0] - selDrag.p[0], p[1] - selDrag.p[1], 1); else transformSel(0, 0, selDrag.k || 1);
      selDrag = null; clearLive(v); drawInk(v); renderItems(v); renderSel(v); save(); bar(); refreshThumb(v.pg);
    }
    if (m !== 'laser') act = null;
  }
  function eraserCursor(v, p) {
    const r = ink.eraser === 'part' ? curSize('eraser') : 12, c = v.ctx.live;
    c.save(); c.strokeStyle = '#94a3b8'; c.lineWidth = 1.5 / scale; c.beginPath(); c.arc(p[0], p[1], r, 0, 7); c.stroke(); c.restore();
  }
  function eraseAt(v, p) {
    const pg = v.pg, part = ink.eraser === 'part', r = part ? curSize('eraser') : 12;
    let changed = false;
    const out = [];
    for (const s of pg.strokes) {
      if (ink.eraseHlOnly && s.tool !== 'hl') { out.push(s); continue; }
      const reach = r + (s.tool === 'hl' ? s.size * 2.5 : s.size / 2);
      if (!strokeHit(s, p, reach)) { out.push(s); continue; }
      changed = true;
      if (!part) continue;
      const runs = []; let run = [];
      for (const q of densify(s.pts, 3)) { if (dist(q, p) < reach) { if (run.length > 1) runs.push(run); run = []; } else run.push(q); }
      if (run.length > 1) runs.push(run);
      for (const pts2 of runs) out.push({ ...s, pts: pts2 });
    }
    if (changed) { pg.strokes = out; erasing.changed = true; drawInk(v); }
    clearLive(v); eraserCursor(v, p);
  }
  function runLaser() {
    if (laser.raf) return;
    const tick = () => {
      const now = performance.now(), v = laser.v;
      laser.pts = laser.pts.filter(q => now - q[2] < 700);
      if (!v || !V.has(v.pg)) { laser.pts = []; laser.raf = 0; return; }
      clearLive(v);
      const c = v.ctx.live, P = laser.pts, s = Math.max(0.6, scale);
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = '#ff2d55'; c.shadowBlur = 12;
      for (let i = 1; i < P.length; i++) {
        if (P[i][2] - P[i - 1][2] > 80) continue;
        const age = (now - P[i][2]) / 700;
        c.globalAlpha = Math.max(0, 1 - age); c.strokeStyle = '#ff2d55'; c.lineWidth = (5 - age * 3) / s;
        c.beginPath(); c.moveTo(P[i - 1][0], P[i - 1][1]); c.lineTo(P[i][0], P[i][1]); c.stroke();
      }
      if (P.length && mode === 'laser') { const l = P[P.length - 1]; c.globalAlpha = 1; c.fillStyle = '#ff2d55'; c.beginPath(); c.arc(l[0], l[1], 5 / s, 0, 7); c.fill(); }
      c.restore();
      laser.raf = P.length || mode === 'laser' ? requestAnimationFrame(tick) : 0;
      if (!laser.raf) act = null;
    };
    laser.raf = requestAnimationFrame(tick);
  }

  /* text boxes */
  function addText(v, p) {
    const it = { id: uid(), type: 'text', x: p[0], y: p[1] - ink.textSize * 0.8, w: Math.min(440, pageW(v.pg) - p[0] - 20), size: ink.textSize, color: curColor('text'), text: '' };
    pushUndo(v.pg); v.pg.items.push(it); renderItems(v);
    v.items.querySelector(`[data-item="${it.id}"]`)?.focus();
  }
  col.addEventListener('input', e => {
    const el = e.target.closest('.ti'); if (!el) return;
    const pg = nb.pages[+el.closest('.pg').dataset.i], it = pg?.items.find(x => x.id === el.dataset.item); if (!it) return;
    it.text = el.innerText.replace(/\n$/, ''); save(); refreshThumb(pg);
  });
  col.addEventListener('focusout', e => {
    const el = e.target.closest('.ti'); if (!el) return;
    const pg = nb.pages[+el.closest('.pg').dataset.i], it = pg?.items.find(x => x.id === el.dataset.item);
    if (it && !it.text.trim()) { pg.items = pg.items.filter(x => x !== it); repaintPg(pg); save(); }
  });

  col.addEventListener('pointerdown', down);
  col.addEventListener('pointermove', move);
  col.addEventListener('pointerup', up);
  col.addEventListener('pointercancel', e => { touches.delete(e.pointerId); if (!touches.size && gesture) { gesture = null; commitZoom(); } abortStroke(); if (mode !== 'laser') act = null; });
  col.addEventListener('pointerleave', () => { if (!mode && ink.tool === 'eraser') for (const v of V.values()) clearLive(v); });

  const onKey = e => {
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]') || $('#dlg').open) return;
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); A[e.shiftKey ? 'ink-redo' : 'ink-undo'](); return; }
    if ((e.metaKey || e.ctrlKey) && ['=', '+', '-', '0'].includes(k)) { e.preventDefault(); zoomBy(k === '-' ? -1 : k === '0' ? 0 : 1); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((k === 'backspace' || k === 'delete') && ink.sel) { e.preventDefault(); A['sel-del'](); return; }
    if (k === 'escape') { closePop(); if (ink.sel) { const v = V.get(ink.sel.pg); ink.sel = null; if (v) renderSel(v); } return; }
    const tool = TOOLS.find(x => x[2].toLowerCase() === k);
    if (tool) A['ink-tool']({ dataset: { tool: tool[0] } });
    if (k === 'pagedown') { e.preventDefault(); scrollToPage(Math.min(nb.pages.length - 1, ui.inkPage + 1)); }
    if (k === 'pageup') { e.preventDefault(); scrollToPage(Math.max(0, ui.inkPage - 1)); }
  };
  document.addEventListener('keydown', onKey);
  let resizeTimer = null, lastW = 0;
  const ro = new ResizeObserver(() => {
    if (Math.abs(stage.clientWidth - lastW) < 2) return;
    lastW = stage.clientWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { const keep = ui.inkPage; computeScale(); sizeShells(); for (const v of V.values()) paint(v); scrollToPage(keep, false); }, 120);
  });

  inkApi = {
    nb, curPg, buildShells, repaintPg, pushUndo, restore, bar, thumbs, scrollToPage, zoomBy, openPop, closePop, refreshThumb,
    viewOf: pg => V.get(pg), renderSel, drawInk, renderItems,
    rebuild(keep = ui.inkPage) { buildShells(); thumbs(); bar(); floatBar(); requestAnimationFrame(() => scrollToPage(Math.min(keep, nb.pages.length - 1), false)); },
  };
  cleanup = () => { ro.disconnect(); io?.disconnect(); thumbIO?.disconnect(); cancelAnimationFrame(laser.raf); document.removeEventListener('keydown', onKey); inkApi = null; ink.sel = null; };
  bar(); floatBar(); thumbs();
  requestAnimationFrame(() => { lastW = stage.clientWidth; buildShells(); ro.observe(stage); scrollToPage(ui.inkPage, false); });
}

/* ---------- page menus ---------- */
function pageDialog(nb, i) {
  const pg = nb.pages[i], land = pageW(pg) > pageH(pg);
  openDialog(`<h3>الصفحة ${i + 1}</h3>
    ${pg.pdfPage ? '<p class="note">صفحة من الكتاب</p>' : `${templatePicker(pg.paper || nb.paper, pg.paperColor || nb.paperColor)}
      <div class="row wrap"><label>الاتجاه<span class="seg"><label><input type="radio" name="orient" value="p" ${land ? '' : 'checked'}><span class="o-p" title="عمودي"></span></label><label><input type="radio" name="orient" value="l" ${land ? 'checked' : ''}><span class="o-l" title="بالعرض"></span></label></span></label></div>
      <label class="check-row"><input type="checkbox" name="all"> طبّق على كل صفحات الدفتر</label>`}
    <span class="note">الصفحة</span>
    <div class="row wrap">
      <button class="btn" value="dup" formnovalidate>تكرار</button>
      <button class="btn" value="up" formnovalidate ${i ? '' : 'disabled'}>نقل قبل</button>
      <button class="btn" value="down" formnovalidate ${i < nb.pages.length - 1 ? '' : 'disabled'}>نقل بعد</button>
      <button class="btn" value="clear" formnovalidate>مسح الكتابة</button>
    </div>
    <span class="note">تصدير</span>
    <div class="row wrap">
      <button class="btn" value="png" formnovalidate>الصفحة كصورة</button>
      ${desktop ? '<button class="btn" value="drive" formnovalidate>الصفحة إلى قوقل درايف</button>' : ''}
      <button class="btn" value="pdf" formnovalidate>الدفتر كامل PDF</button>
    </div>
    <span class="note">الإصبع على الشاشة</span>
    <div class="row wrap">${[['auto', 'تلقائي'], ['draw', 'يرسم'], ['pan', 'يحرّك الصفحة']].map(([k, n]) => `<button class="btn small ${ink.finger === k ? 'primary' : ''}" value="finger:${k}" formnovalidate>${n}</button>`).join('')}</div>
    <div class="dlg-actions">${pg.pdfPage ? '' : '<button class="btn primary" value="save">حفظ</button>'}<button class="btn" value="cancel" formnovalidate>إغلاق</button><span class="grow"></span><button class="btn danger" value="delete" formnovalidate ${nb.pages.length > 1 ? '' : 'disabled'}>حذف الصفحة</button></div>`, async (fd, v) => {
    const api = inkApi;
    if (v.startsWith('finger:')) { ink.finger = v.slice(7); keepInkPrefs(); api?.bar(); return; }
    if (v === 'save') {
      const paper = fd.get('paper'), color = fd.get('paperColor'), toLand = fd.get('orient') === 'l';
      const apply = p => {
        if (p.pdfPage) return;
        if (p.paper !== paper) p.tpl = tplInit(paper, p.tpl?.date);
        p.paper = paper; p.paperColor = color;
        if ((pageW(p) > pageH(p)) !== toLand) [p.w, p.h] = [pageH(p), pageW(p)];
      };
      if (fd.get('all') === 'on') { nb.paper = paper; nb.paperColor = color; nb.pages.forEach(apply); } else apply(pg);
    }
    if (v === 'dup') nb.pages.splice(i + 1, 0, { ...structuredClone(pg), id: uid(), mark: false });
    if (v === 'up' || v === 'down') { const j = v === 'up' ? i - 1 : i + 1; [nb.pages[i], nb.pages[j]] = [nb.pages[j], nb.pages[i]]; ui.inkPage = j; }
    if (v === 'clear') { api?.pushUndo(pg); pg.strokes = []; pg.items = []; }
    if (v === 'delete') return void setTimeout(() => ask(`تحذف الصفحة ${i + 1}؟`, 'حذف', () => { nb.pages.splice(i, 1); save(); api?.rebuild(Math.max(0, i - 1)); }));
    if (v === 'png' || v === 'drive') { const b = await pageBlob(nb, pg); return saveOut(`${nb.name}-${i + 1}.png`, new Uint8Array(await b.arrayBuffer()), v === 'drive'); }
    if (v === 'pdf') return exportPdf(nb);
    save();
    if (api) { if (v === 'clear') api.repaintPg(pg); else api.rebuild(v === 'dup' ? i + 1 : ui.inkPage); }
  });
}

/* ---------- actions ---------- */
function insertImage() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files[0], api = inkApi; if (!f || !api) return;
    const pg = api.curPg(), key = await putBlob(f), bm = await createImageBitmap(f); imgCache.set(key, bm);
    const w = Math.min(pageW(pg) * 0.6, bm.width), h = w * bm.height / bm.width;
    const it = { id: uid(), type: 'image', blob: key, x: (pageW(pg) - w) / 2, y: Math.max(40, (pageH(pg) - h) / 2), w, h };
    api.pushUndo(pg); pg.items.push(it);
    ink.tool = 'lasso'; ink.sel = { pg, strokes: new Set(), items: new Set([it]), box: { x: it.x, y: it.y, w, h } };
    save(); api.repaintPg(pg); api.bar(); api.refreshThumb(pg);
  };
  inp.click();
}
function selChanged(pg) { save(); inkApi.repaintPg(pg); inkApi.bar(); inkApi.refreshThumb(pg); }
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
  'ink-tool': a => {
    const t = a.dataset.tool;
    if (t === 'image') return insertImage();
    if (ink.tool === t && a.closest) { inkApi.openPop(a); return; }
    ink.tool = t; inkApi.closePop();
    if (ink.sel) { const v = inkApi.viewOf(ink.sel.pg); ink.sel = null; if (v) inkApi.renderSel(v); }
    inkApi.bar(); keepInkPrefs();
  },
  'ink-cslot': a => {
    const k = toolKind(ink.tool), i = +a.dataset.i;
    if (ink.colorIdx[k] !== i) { ink.colorIdx[k] = i; keepInkPrefs(); inkApi.bar(); return; }
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = ink.colors[k][i];
    inp.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(inp);
    inp.addEventListener('input', () => { ink.colors[k][i] = inp.value; keepInkPrefs(); inkApi?.bar(); });
    inp.addEventListener('change', () => inp.remove());
    inp.click();
  },
  'ink-sslot': a => { const k = ink.tool === 'shape' ? 'pen' : ink.tool; ink.sizeIdx[k] = +a.dataset.i; keepInkPrefs(); inkApi.bar(); },
  'pen-style': a => { ink.penStyle = a.dataset.s; keepInkPrefs(); inkApi.closePop(); inkApi.bar(); },
  'eraser-mode': a => { ink.eraser = a.dataset.m; keepInkPrefs(); inkApi.closePop(); inkApi.bar(); },
  'erase-hl': () => { ink.eraseHlOnly = !ink.eraseHlOnly; keepInkPrefs(); inkApi.closePop(); inkApi.bar(); toast(ink.eraseHlOnly ? 'الممحاة تمسح التظليل فقط' : 'الممحاة تمسح كل شي'); },
  'shape-kind': a => { ink.shape = a.dataset.s; keepInkPrefs(); inkApi.closePop(); inkApi.bar(); },
  'text-size': a => { ink.textSize = +a.dataset.s; keepInkPrefs(); inkApi.closePop(); },
  'ink-undo': () => inkApi && inkApi.restore(ink.undo, ink.redo),
  'ink-redo': () => inkApi && inkApi.restore(ink.redo, ink.undo),
  'ink-zoom': a => inkApi?.zoomBy(+a.dataset.z),
  'ink-thumbs': () => { ink.thumbs = !ink.thumbs; keepInkPrefs(); inkApi.bar(); inkApi.thumbs(); },
  'marks-only': () => { ink.marksOnly = !ink.marksOnly; inkApi.thumbs(); },
  'ink-mark': () => { const pg = inkApi.curPg(); pg.mark = !pg.mark; save(); inkApi.bar(); inkApi.thumbs(); },
  'ink-goto': a => inkApi.scrollToPage(+a.dataset.i),
  'ink-add-page': () => {
    const nb = inkApi.nb, cur = inkApi.curPg(), i = ui.inkPage;
    const pg = { id: uid(), strokes: [], items: [], w: pageW(cur), h: pageH(cur) };
    if (!cur.pdfPage) Object.assign(pg, { paper: cur.paper, paperColor: cur.paperColor, tpl: tplNext(cur.paper || nb.paper, cur.tpl) });
    nb.pages.splice(i + 1, 0, pg);
    save(); inkApi.rebuild(i + 1);
  },
  'ink-more': () => pageDialog(inkApi.nb, ui.inkPage),
  'thumb-menu': a => pageDialog(inkApi.nb, +a.dataset.i),
  'sel-del': () => {
    const s = ink.sel; if (!s || !inkApi) return;
    const pg = s.pg; inkApi.pushUndo(pg);
    pg.strokes = pg.strokes.filter(x => !s.strokes.has(x)); pg.items = pg.items.filter(x => !s.items.has(x));
    ink.sel = null; selChanged(pg);
  },
  'sel-cut': () => { const s = ink.sel; if (!s) return; ink.clip = { strokes: [...s.strokes], items: [...s.items] }; A['sel-del'](); toast('انقص. اضغط ⌘V للصق'); },
  'sel-dup': () => {
    const s = ink.sel; if (!s || !inkApi) return;
    const pg = s.pg; inkApi.pushUndo(pg);
    const mv = p => [p[0] + 30, p[1] + 30, p[2]];
    const ns = [...s.strokes].map(x => ({ ...x, pts: x.pts.map(mv) })), ni = [...s.items].map(x => ({ ...x, id: uid(), x: x.x + 30, y: x.y + 30 }));
    pg.strokes.push(...ns); pg.items.push(...ni);
    ink.sel = { pg, strokes: new Set(ns), items: new Set(ni), box: { ...s.box, x: s.box.x + 30, y: s.box.y + 30 } };
    selChanged(pg);
  },
  'sel-color': a => {
    const s = ink.sel; if (!s || !inkApi) return;
    const pg = s.pg, c = a.dataset.c; inkApi.pushUndo(pg);
    const ns = new Set(), ni = new Set();
    pg.strokes = pg.strokes.map(x => { if (!s.strokes.has(x)) return x; const t = { ...x, color: c }; ns.add(t); return t; });
    pg.items = pg.items.map(x => { if (!s.items.has(x)) return x; const t = x.type === 'text' ? { ...x, color: c } : x; ni.add(t); return t; });
    ink.sel = { pg, strokes: ns, items: ni, box: s.box };
    selChanged(pg);
  },
});
document.addEventListener('keydown', e => {
  if (!inkApi || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'v' || !ink.clip || e.target.closest?.('[contenteditable="true"],input,textarea')) return;
  e.preventDefault();
  const pg = inkApi.curPg(); inkApi.pushUndo(pg);
  const ns = ink.clip.strokes.map(x => ({ ...x })), ni = ink.clip.items.map(x => ({ ...x, id: uid() }));
  pg.strokes.push(...ns); pg.items.push(...ni);
  ink.tool = 'lasso';
  const all = [...ns.flatMap(s => s.pts), ...ni.map(i => [i.x, i.y]), ...ni.map(i => [i.x + i.w, i.y + (i.h || i.size)])];
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  ink.sel = { pg, strokes: new Set(ns), items: new Set(ni), box: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } };
  selChanged(pg);
});
