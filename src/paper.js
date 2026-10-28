'use strict';
/* ---------- paper: sizes, colors and page templates (including planners) ---------- */

// Page units: the short side of a page is always 1000 units.
const PAPER_SIZES = { a4: ['A4', 1.4142], letter: ['Letter', 1.2941], square: ['مربع', 1], wide: ['عريض 16:9', 1.7778] };
function pageDims(size = 'a4', landscape = false) {
  const r = (PAPER_SIZES[size] || PAPER_SIZES.a4)[1];
  return landscape ? { w: Math.round(1000 * r), h: 1000 } : { w: 1000, h: Math.round(1000 * r) };
}
const pageW = pg => pg.w || 1000;
const pageH = pg => pg.h || 1414;

const PAPERS = {
  blank: ['سادة', 'basic'], lined: ['مسطّر', 'basic'], narrow: ['مسطّر ضيق', 'basic'], grid: ['مربعات', 'basic'], dots: ['نقاط', 'basic'],
  cornell: ['كورنيل', 'basic'], music: ['نوتة موسيقية', 'basic'],
  daily: ['يومي', 'planner'], weekly: ['أسبوعي', 'planner'], monthly: ['شهري', 'planner'], habits: ['متتبع العادات', 'planner'],
  todo: ['قائمة مهام', 'planner'], goals: ['أهداف', 'planner'], meeting: ['اجتماع', 'planner'], reading: ['سجل قراءة', 'planner'],
};
const PAPER_COLORS = {
  white: ['#ffffff', '#d9dee6', 'أبيض'], cream: ['#fbf7ee', '#e4dac6', 'كريمي'], yellow: ['#fff8d6', '#e8dca4', 'أصفر'],
  blue: ['#f0f5fc', '#cbd8ea', 'أزرق'], green: ['#f1f8f2', '#c8dfcc', 'أخضر'], dark: ['#1f2328', '#3b434c', 'داكن'],
};
const isDark = key => key === 'dark';

// planner pages remember their date so new pages continue from it
function weekStart(ds) { const d = parseYmd(ds); d.setDate(d.getDate() - d.getDay()); return ymd(d); }
function tplInit(paper, from) {
  const t = from || todayStr();
  if (paper === 'daily') return { date: t };
  if (paper === 'weekly') return { date: weekStart(t) };
  if (paper === 'monthly' || paper === 'habits') return { month: t.slice(0, 7) };
  return null;
}
function tplNext(paper, tpl) {
  if (!tpl) return tplInit(paper);
  if (paper === 'daily') return { date: addDays(tpl.date, 1) };
  if (paper === 'weekly') return { date: addDays(tpl.date, 7) };
  if (tpl.month) { const d = parseYmd(tpl.month + '-01'); d.setMonth(d.getMonth() + 1); return { month: ymd(d).slice(0, 7) }; }
  return null;
}

function drawPaper(c, nb, pg) {
  const W = pageW(pg), H = pageH(pg);
  const colorKey = pg.paperColor || nb.paperColor || 'white';
  const [bg, line] = PAPER_COLORS[colorKey] || PAPER_COLORS.white;
  const paper = pg.pdfPage ? 'blank' : (pg.paper || nb.paper || 'blank');
  const P = {
    c, W, H, line, dark: isDark(colorKey),
    ac: nb.color || '#4f46e5',
    text: isDark(colorKey) ? '#e5e7eb' : '#334155',
    muted: isDark(colorKey) ? '#8b95a1' : '#94a3b8',
    tpl: pg.tpl || tplInit(paper),
  };
  c.save();
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.strokeStyle = line; c.fillStyle = line; c.lineWidth = 1.3;
  (TEMPLATES[paper] || (() => {}))(P);
  c.restore();
}

/* drawing helpers for templates */
const hl = (P, y, x0 = 50, x1 = P.W - 50, w = 1.3, color = P.line) => { const c = P.c; c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); };
const vl = (P, x, y0, y1, w = 1.3, color = P.line) => { const c = P.c; c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); };
function txt(P, s, x, y, { size = 22, weight = 500, color = P.text, align = 'right' } = {}) {
  const c = P.c; c.fillStyle = color; c.font = `${weight} ${size}px "IBM Plex Sans Arabic", system-ui, sans-serif`;
  c.textAlign = align; c.direction = 'rtl'; c.textBaseline = 'alphabetic'; c.fillText(s, x, y);
}
function box(P, x, y, w, h, r = 14, stroke = P.line, lw = 1.4) {
  const c = P.c; c.strokeStyle = stroke; c.lineWidth = lw; c.beginPath(); c.roundRect(x, y, w, h, r); c.stroke();
}
const checkbox = (P, x, y, s = 22) => box(P, x - s, y - s + 4, s, s, 5, P.muted, 1.6);
function header(P, title, sub) {
  txt(P, title, P.W - 60, 104, { size: 46, weight: 700, color: P.ac });
  if (sub) txt(P, sub, P.W - 60, 142, { size: 21, color: P.muted });
  hl(P, 168, 60, P.W - 60, 3, P.ac);
}
function section(P, label, x0, x1, y) {
  txt(P, label, x1, y, { size: 21, weight: 600, color: P.ac });
  hl(P, y + 12, x0, x1, 1.2, P.line);
}
const ruled = (P, x0, x1, y0, y1, step = 44) => { for (let y = y0; y <= y1; y += step) hl(P, y, x0, x1, 1.1); };

const TEMPLATES = {
  blank() {},
  lined(P) { ruled(P, 50, P.W - 50, 140, P.H - 50, 44); vl(P, P.W - 110, 40, P.H - 40, 1.3, '#f0a8a8'); },
  narrow(P) { ruled(P, 50, P.W - 50, 130, P.H - 50, 32); vl(P, P.W - 110, 40, P.H - 40, 1.3, '#f0a8a8'); },
  grid(P) { for (let x = 20; x <= P.W; x += 40) vl(P, x, 0, P.H, 1); for (let y = 27; y <= P.H; y += 40) hl(P, y, 0, P.W, 1); },
  dots(P) { const c = P.c; c.fillStyle = P.line; for (let x = 20; x <= P.W; x += 40) for (let y = 27; y <= P.H; y += 40) { c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); } },
  cornell(P) {
    const cue = P.W - Math.min(300, P.W * 0.3), sum = P.H - Math.min(260, P.H * 0.2);
    ruled(P, 50, cue - 10, 196, sum - 20, 44);
    hl(P, 150, 30, P.W - 30, 2); hl(P, sum, 30, P.W - 30, 2); vl(P, cue, 150, sum, 2);
    txt(P, 'الأسئلة', P.W - 50, 190, { size: 18, color: P.muted }); txt(P, 'الملخص', P.W - 50, sum + 34, { size: 18, color: P.muted });
  },
  music(P) { for (let y = 150; y < P.H - 120; y += 120) for (let k = 0; k < 5; k++) hl(P, y + k * 14, 50, P.W - 50, 1.2); },

  daily(P) {
    const d = P.tpl.date;
    header(P, fmt(d, { weekday: 'long' }), `${fmt(d, { day: 'numeric', month: 'long', year: 'numeric' })} · ${hijri(d)}`);
    const top = 220, bottom = P.H - 140, mid = P.W / 2;
    // schedule (right column)
    section(P, 'الجدول', mid + 20, P.W - 60, top);
    const hours = 16, rowH = (bottom - top - 40) / hours;
    for (let i = 0; i <= hours; i++) {
      const y = top + 40 + i * rowH;
      hl(P, y, mid + 20, P.W - 60, 1);
      if (i < hours) txt(P, `${6 + i}:00`, P.W - 64, y + 26, { size: 16, color: P.muted });
    }
    vl(P, P.W - 140, top + 40, bottom, 1);
    // priorities, tasks, notes (left column)
    section(P, 'أهم ثلاث مهام', 60, mid - 20, top);
    for (let i = 0; i < 3; i++) { const y = top + 80 + i * 52; checkbox(P, mid - 26, y); hl(P, y + 8, 60, mid - 60, 1); }
    const t2 = top + 280;
    section(P, 'المهام', 60, mid - 20, t2);
    const n = Math.max(3, Math.floor((bottom - t2 - 280) / 48));
    for (let i = 0; i < n; i++) { const y = t2 + 70 + i * 48; checkbox(P, mid - 26, y); hl(P, y + 8, 60, mid - 60, 1); }
    const t3 = t2 + 70 + n * 48 + 20;
    section(P, 'ملاحظات', 60, mid - 20, t3);
    ruled(P, 60, mid - 20, t3 + 56, bottom, 44);
    // water tracker
    txt(P, 'الماء', P.W - 60, P.H - 70, { size: 19, weight: 600, color: P.ac });
    for (let i = 0; i < 8; i++) box(P, P.W - 150 - i * 52, P.H - 98, 34, 40, 10, P.muted, 1.4);
  },
  weekly(P) {
    const s = P.tpl.date, e = addDays(s, 6);
    header(P, 'الأسبوع', `${fmt(s, { day: 'numeric', month: 'long' })} – ${fmt(e, { day: 'numeric', month: 'long', year: 'numeric' })}`);
    const top = 200, gap = 20, cols = P.W > P.H ? 4 : 2, rows = Math.ceil(8 / cols);
    const bw = (P.W - 120 - gap * (cols - 1)) / cols, bh = (P.H - top - 60 - gap * (rows - 1)) / rows;
    for (let k = 0; k < 8; k++) {
      const r = Math.floor(k / cols), cI = k % cols;
      const x = P.W - 60 - (cI + 1) * bw - cI * gap, y = top + r * (bh + gap);
      box(P, x, y, bw, bh, 16);
      if (k < 7) {
        const d = addDays(s, k);
        txt(P, DOW[k], x + bw - 20, y + 42, { size: 22, weight: 700, color: P.ac });
        txt(P, String(parseYmd(d).getDate()), x + 24, y + 44, { size: 26, weight: 600, color: P.muted, align: 'left' });
      } else txt(P, 'ملاحظات', x + bw - 20, y + 42, { size: 22, weight: 700, color: P.ac });
      ruled(P, x + 18, x + bw - 18, y + 96, y + bh - 20, 42);
    }
  },
  monthly(P) {
    const m = P.tpl.month, first = parseYmd(m + '-01');
    const lastD = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    header(P, fmt(m + '-01', { month: 'long' }), `${first.getFullYear()} · ${hijri(m + '-01').replace(/^\d+\s/, '')} – ${hijri(ymd(lastD)).replace(/^\d+\s/, '')}`);
    const top = 200, notes = P.W > P.H ? 0 : 190;
    const cw = (P.W - 120) / 7, headH = 44, ch = (P.H - top - headH - 50 - notes) / 6;
    for (let i = 0; i < 7; i++) txt(P, DOW_SHORT[i], P.W - 60 - i * cw - cw / 2, top + 30, { size: 19, weight: 600, color: P.ac, align: 'center' });
    const start = new Date(first); start.setDate(1 - first.getDay());
    for (let k = 0; k < 42; k++) {
      const d = new Date(start); d.setDate(start.getDate() + k);
      const r = Math.floor(k / 7), cI = k % 7, x = P.W - 60 - (cI + 1) * cw, y = top + headH + r * ch;
      P.c.strokeStyle = P.line; P.c.lineWidth = 1.2; P.c.strokeRect(x, y, cw, ch);
      const inMonth = d.getMonth() === first.getMonth();
      txt(P, String(d.getDate()), x + cw - 12, y + 30, { size: 20, weight: 600, color: inMonth ? P.text : P.line });
    }
    if (notes) { const y = P.H - notes - 10; section(P, 'ملاحظات', 60, P.W - 60, y + 20); ruled(P, 60, P.W - 60, y + 76, P.H - 60, 42); }
  },
  habits(P) {
    const m = P.tpl.month, first = parseYmd(m + '-01');
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    header(P, 'متتبع العادات', `${fmt(m + '-01', { month: 'long', year: 'numeric' })}`);
    const top = 210, nameW = Math.min(260, P.W * 0.26), x1 = P.W - 60, x0 = 60;
    const cw = (x1 - nameW - x0) / days, rows = 14, rh = (P.H - top - 90) / (rows + 1);
    txt(P, 'العادة', x1 - 10, top + rh * 0.65, { size: 18, weight: 600, color: P.ac });
    for (let dI = 0; dI < days; dI++) txt(P, String(dI + 1), x1 - nameW - dI * cw - cw / 2, top + rh * 0.65, { size: Math.min(15, cw * 0.55), color: P.muted, align: 'center' });
    for (let r = 1; r <= rows; r++) {
      const y = top + r * rh;
      hl(P, y, x0, x1, 1);
      for (let dI = 0; dI < days; dI++) { const cx = x1 - nameW - dI * cw - cw / 2; P.c.strokeStyle = P.line; P.c.lineWidth = 1.2; P.c.beginPath(); P.c.arc(cx, y + rh / 2, Math.min(cw, rh) * 0.3, 0, 7); P.c.stroke(); }
    }
    hl(P, top + (rows + 1) * rh, x0, x1, 1);
    vl(P, x1 - nameW, top, top + (rows + 1) * rh, 1.4);
  },
  todo(P) {
    header(P, 'قائمة المهام', 'التاريخ: ____________');
    for (let y = 240; y < P.H - 60; y += 58) { checkbox(P, P.W - 66, y); hl(P, y + 10, 60, P.W - 106, 1.1); }
  },
  goals(P) {
    header(P, 'أهدافي', 'اكتب أهدافك وقسّمها لخطوات صغيرة');
    const names = ['شخصي', 'العمل والدراسة', 'الصحة', 'التعلّم'];
    const top = 210, gap = 22, cols = 2, bw = (P.W - 120 - gap) / cols, bh = (P.H - top - 60 - gap) / 2;
    names.forEach((n, k) => {
      const r = Math.floor(k / cols), cI = k % cols, x = P.W - 60 - (cI + 1) * bw - cI * gap, y = top + r * (bh + gap);
      box(P, x, y, bw, bh, 18);
      txt(P, n, x + bw - 24, y + 46, { size: 24, weight: 700, color: P.ac });
      for (let yy = y + 110; yy < y + bh - 20; yy += 54) { checkbox(P, x + bw - 28, yy); hl(P, yy + 10, x + 22, x + bw - 64, 1); }
    });
  },
  meeting(P) {
    header(P, 'ملاحظات اجتماع');
    const x1 = P.W - 60;
    [['الموضوع', 230], ['التاريخ', 290], ['الحضور', 350]].forEach(([l, y]) => { txt(P, l, x1, y, { size: 20, weight: 600, color: P.ac }); hl(P, y + 8, 60, x1 - 110, 1.1); });
    const split = P.H * 0.66;
    section(P, 'النقاط', 60, x1, 430);
    ruled(P, 60, x1, 490, split - 30, 44);
    section(P, 'المهام القادمة', 60, x1, split + 10);
    txt(P, 'المسؤول', 200, split + 10, { size: 17, color: P.muted, align: 'center' });
    for (let y = split + 76; y < P.H - 60; y += 54) { checkbox(P, x1 - 6, y); hl(P, y + 10, 340, x1 - 46, 1); hl(P, y + 10, 60, 320, 1); }
  },
  reading(P) {
    header(P, 'سجل القراءة');
    const x1 = P.W - 60, x0 = 60, w = x1 - x0;
    const cols = [['الكتاب', 0.36], ['المؤلف', 0.24], ['بدأت', 0.12], ['انتهيت', 0.12], ['التقييم', 0.16]];
    const top = 220, rh = 58;
    let x = x1;
    for (const [n, f] of cols) { txt(P, n, x - 12, top + 36, { size: 19, weight: 600, color: P.ac }); x -= w * f; if (x > x0 + 1) vl(P, x, top, P.H - 60, 1); }
    for (let y = top + rh; y < P.H - 60; y += rh) {
      hl(P, y, x0, x1, 1);
      for (let s = 0; s < 5; s++) star(P, x0 + 22 + s * (w * 0.16 - 30) / 4, y + rh / 2, 9);
    }
    hl(P, top + rh, x0, x1, 2, P.ac);
  },
};
function star(P, cx, cy, r) {
  const c = P.c; c.strokeStyle = P.line; c.lineWidth = 1.3; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
  c.closePath(); c.stroke();
}

/* notebooks made from a planner preset */
function plannerPages(kind, size, landscape) {
  const dims = pageDims(size, landscape), pages = [];
  const add = (paper, tpl, mark = false) => pages.push({ id: uid(), strokes: [], items: [], paper, tpl, mark, ...dims });
  const t = todayStr();
  if (kind === 'year') {
    const y = new Date().getFullYear();
    add('goals', null, true);
    // every week of the year, filed under the month it starts in (the first one under January)
    const weeks = [];
    for (let w = weekStart(`${y}-01-01`); w <= `${y}-12-31`; w = addDays(w, 7)) weeks.push(w);
    for (let m = 0; m < 12; m++) {
      const mk = `${y}-${pad(m + 1)}`;
      add('monthly', { month: mk }, true);
      add('habits', { month: mk });
      for (const w of weeks) if ((w < `${y}-01-01` ? `${y}-01` : w.slice(0, 7)) === mk) add('weekly', { date: w });
    }
  } else if (kind === 'month') {
    const mk = t.slice(0, 7), first = parseYmd(mk + '-01');
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    add('monthly', { month: mk }, true);
    for (let d = 1; d <= days; d++) add('daily', { date: `${mk}-${pad(d)}` }, d === 1);
  }
  return pages;
}
