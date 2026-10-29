'use strict';
/* ---------- welcome content: a guide page in Notes and a sample notebook ---------- */

/* ===== notes guide ===== */
function guidePages() {
  const b = (type, html = '', extra = {}) => ({ ...blk(type, html), ...extra });
  const table = rows => Object.assign(blk('table'), { rows });
  const child = { id: uid(), title: 'مثال: صفحة فرعية', icon: '📎', cover: null, updated: Date.now() - 1000, blocks: [
    b('p', 'هذي صفحة داخل «دليل الملاحظات». تقدر تسوي صفحات داخل صفحات بالعدد اللي تبيه، وتطلع لك كشجرة في القائمة الجانبية.'),
    b('todo', 'ارجع للدليل من الشريط اللي فوق العنوان', { checked: false }),
  ] };
  const guide = {
    id: uid(), title: 'دليل الملاحظات', icon: '📘', fav: true, parentId: null, updated: Date.now(),
    cover: { bg: 'linear-gradient(135deg,#667eea,#764ba2)' },
    blocks: [
      b('callout', 'هذي صفحة تعريفية. جرّب فيها كل شي براحتك، وتقدر تحذفها متى ما تبي من «حذف الصفحة» فوق.', { icon: '👋' }),
      b('toc'),
      b('h1', 'أوامر السلاش /'),
      b('p', 'اكتب <code>/</code> في بداية أي سطر وتطلع لك قائمة بكل الأوامر. كمّل الكتابة عشان تفلترها، مثلاً <code>/جدول</code> أو <code>/كود</code>، وبعدها اضغط Enter.'),
      table([
        ['الأمر', 'وش يسوي'],
        ['نص، عنوان 1، 2، 3', 'فقرات وعناوين بأحجام مختلفة'],
        ['قائمة نقطية، مرقمة، مهام', 'قوائم، ومربعات تشيّكها'],
        ['قائمة منسدلة', 'عنوان يفتح ويسكر وتحته محتوى'],
        ['ملاحظة بارزة، اقتباس، فاصل', 'تبرز فكرة، أو تقتبس، أو تفصل الأقسام'],
        ['كود', 'كود ملوّن بأكثر من 20 لغة، مع زر نسخ'],
        ['جدول', 'صفوف وأعمدة تضيفها وتحذفها'],
        ['معادلة', 'معادلات رياضية بصيغة TeX'],
        ['فهرس المحتويات', 'روابط لكل عناوين الصفحة'],
        ['صورة، فيديو، صوت، ملف، PDF', 'ترفعها أو تسحبها وتفلتها في الصفحة'],
        ['صفحة فرعية، رابط لصفحة', 'صفحات داخل صفحات وروابط بينها'],
        ['رابط ويب، ملف من قوقل درايف', 'بطاقات روابط وملفات'],
      ]),
      b('h1', 'اختصارات الكتابة'),
      b('p', 'اكتب الرمز في بداية السطر وبعده مسافة، ويتحول السطر لحاله:'),
      table([
        ['اكتب', 'يصير'],
        ['# ', 'عنوان كبير'], ['## ', 'عنوان متوسط'], ['### ', 'عنوان صغير'],
        ['- ', 'قائمة نقطية'], ['1. ', 'قائمة مرقمة'], ['[] ', 'مربع مهمة'],
        ['> ', 'قائمة منسدلة'], ['" ', 'اقتباس'], ['! ', 'ملاحظة بارزة'],
        ['```', 'كتلة كود'], ['---', 'خط فاصل'],
      ]),
      b('h1', 'تنسيق النص'),
      b('p', 'حدد أي كلام ويطلع لك شريط تنسيق: <b>عريض</b>، <i>مائل</i>، <u>تحته خط</u>، <s>يتوسطه خط</s>، <code>كود</code>، <mark data-c="yellow">تظليل أصفر</mark>، <mark data-c="green">أخضر</mark>، <mark data-c="blue">أزرق</mark>، <mark data-c="red">أحمر</mark>، و<a href="https://github.com/tuwra/madar">روابط</a>.'),
      b('p', 'أو بالكيبورد: <code>⌘B</code> عريض، <code>⌘I</code> مائل، <code>⌘U</code> تحته خط، <code>⌘K</code> رابط، و<code>⇧↩</code> سطر جديد داخل نفس الكتلة.'),
      b('h1', 'جرّبها بنفسك'),
      b('todo', 'افتح هذي الصفحة 🎉', { checked: true }),
      b('todo', 'اكتب / تحت واختر «جدول»', { checked: false }),
      b('todo', 'حدد كلمة وظللها بالأصفر', { checked: false }),
      b('todo', 'اسحب هذا السطر من النقاط ⋮⋮ اللي على جنبه لمكان ثاني', { checked: false }),
      b('todo', 'اسحب صورة من جهازك وأفلتها في الصفحة', { checked: false }),
      b('toggle', 'وش فايدة القائمة المنسدلة؟', { open: false, body: 'تخبّي تفاصيل ما تحتاجها كل مرة، مثل الأجوبة أو الشروحات الطويلة. اضغط على السهم عشان تفتحها وتسكرها.' }),
      b('toggle', 'وين تنحفظ ملاحظاتي؟', { open: false, body: 'على جهازك، وتقدر تخليها تتزامن مع قوقل درايف من «الحفظ والمزامنة» تحت يسار التطبيق.' }),
      b('h1', 'أمثلة'),
      b('quote', 'الفكرة المكتوبة أقوى من الفكرة المحفوظة في الراس.'),
      Object.assign(blk('code'), { lang: 'javascript', text: '// كود ملوّن مع زر نسخ\nfunction greet(name) {\n  return `أهلاً ${name}!`;\n}' }),
      Object.assign(blk('math'), { text: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' }),
      { id: uid(), type: 'page', pageId: child.id },
      b('divider'),
      b('h2', 'أشياء ثانية تقدر تسويها'),
      b('bullet', '<b>★ المفضلة</b>: من النجمة فوق الصفحة، وتطلع أول القائمة الجانبية'),
      b('bullet', '<b>غلاف وأيقونة</b>: من فوق الصفحة، أو اضغط على الأيقونة الكبيرة'),
      b('bullet', '<b>قوالب جاهزة</b>: اجتماع، يوميات، مشروع، مذاكرة، قائمة قراءة، خطة أسبوع. تلقاها في «الرئيسية»'),
      b('bullet', '<b>الصق رابط</b> في سطر فاضي ويصير بطاقة رابط'),
      b('bullet', '<b>شريط القوائم</b> فوق الشاشة: اقرأ ملاحظاتك وأضف لها بدون ما تفتح التطبيق'),
      b('callout', 'كل شي هنا تقدر تعدّله وتحذفه. وإذا حذفت الصفحة ما راح ترجع.', { icon: '💡' }),
    ],
  };
  child.parentId = guide.id;
  return [guide, child];
}

/* ===== sample notebook ===== */
function sampleNotebook() {
  let n = 11;
  const rnd = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; }; // same "handwriting" every time
  const r1 = v => Math.round(v * 10) / 10;
  const INK = '#1e293b', BLUE = '#1e3a8a', TEAL = '#0f766e', RED = '#be123c', ORANGE = '#c2410c', GREEN = '#15803d', PURPLE = '#6d28d9';
  // a line through the points that looks drawn by hand: a little wobble and pressure that swells in the middle
  function hand(points, { color = INK, size = 2.4, style = 'fountain', wobble = 0.7 } = {}) {
    const out = [];
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i], steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
      for (let k = i === 1 ? 0 : 1; k <= steps; k++) { const t = k / steps; out.push([ax + (bx - ax) * t + (rnd() - 0.5) * wobble, ay + (by - ay) * t + (rnd() - 0.5) * wobble]); }
    }
    const N = Math.max(1, out.length - 1);
    return { tool: 'pen', style, color, size, o: { ...PEN_DEFAULTS[style] }, pts: out.map(([x, y], i) => [r1(x), r1(y), r1(0.3 + 0.5 * Math.sin(Math.PI * i / N))]) };
  }
  const spline = (cps, per = 10) => {
    const out = [];
    for (let i = 0; i < cps.length - 1; i++) {
      const p0 = cps[Math.max(0, i - 1)], p1 = cps[i], p2 = cps[i + 1], p3 = cps[Math.min(cps.length - 1, i + 2)];
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(d => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    out.push(cps[cps.length - 1]);
    return out;
  };
  const oval = (cx, cy, rx, ry, o) => hand(Array.from({ length: 44 }, (_, i) => { const a = -0.4 + (Math.PI * 2 + 0.5) * i / 43; return [cx + rx * Math.cos(a) * (1 + (rnd() - 0.5) * 0.03), cy + ry * Math.sin(a) * (1 + (rnd() - 0.5) * 0.03)]; }), o);
  const box = (x, y, w, h, o) => hand([[x + 4, y], [x + w, y + 1], [x + w - 1, y + h], [x, y + h - 1], [x + 1, y - 3]], o);
  const line = (x0, y0, x1, y1, o) => hand([[x0, y0], [x1, y1]], o);
  const arrow = (x0, y0, x1, y1, o) => {
    const a = Math.atan2(y1 - y0, x1 - x0), L = 16;
    return [line(x0, y0, x1, y1, o), hand([[x1 - L * Math.cos(a - 0.5), y1 - L * Math.sin(a - 0.5)], [x1, y1], [x1 - L * Math.cos(a + 0.5), y1 - L * Math.sin(a + 0.5)]], o)];
  };
  const dashed = (x0, y0, x1, y1, o, dash = 12) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n2 = Math.floor(len / (dash * 2)), out = [];
    for (let i = 0; i < n2; i++) { const t0 = i * 2 * dash / len, t1 = (i * 2 + 1) * dash / len; out.push(line(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1, { ...o, style: 'ball' })); }
    return out;
  };
  const dashedBox = (x, y, w, h, o) => [...dashed(x, y, x + w, y, o), ...dashed(x + w, y, x + w, y + h, o), ...dashed(x + w, y + h, x, y + h, o), ...dashed(x, y + h, x, y, o)];
  const underline = (x0, x1, y, o) => hand(spline([[x1, y], [(x0 + x1) / 2, y + 3], [x0, y - 1]]), o);
  const hl = (x0, x1, y, color = '#ffe03d', size = 4) => ({ tool: 'hl', style: 'hl', color, size, o: { alpha: 0.5, tip: 'chisel', straight: false }, shape: 'line', pts: [[x0, y, 0.5], [x1, y, 0.5]] });
  const star = (cx, cy, r, o) => hand(Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }), o);
  const check = (x, y, o) => hand([[x, y], [x + 10, y + 12], [x + 30, y - 14]], { size: 3, ...o });
  const bulb = (cx, cy, o = { color: '#a16207', size: 2 }) => [oval(cx, cy, 26, 30, o), hl(cx - 18, cx + 18, cy, '#ffe03d', 7), line(cx - 12, cy + 34, cx + 12, cy + 34, o), line(cx - 10, cy + 42, cx + 10, cy + 42, o), hand(spline([[cx - 8, cy + 10], [cx, cy - 8], [cx + 8, cy + 10]]), { ...o, size: 1.5 })];
  // text boxes: right-aligned Arabic, so `right` is where a line ends
  const T = (text, right, y, w, size = 22, color = INK) => ({ id: uid(), type: 'text', x: right - w, y, w, size, color, text });
  const page = (strokes, items) => ({ id: uid(), w: 1000, h: 1414, paper: 'study', strokes: strokes.flat(Infinity), items, mark: false });
  const header = (title, no) => [T(title, 960, 42, 620, 24, BLUE), T(`صفحة ${no}`, 230, 46, 190, 20, '#64748b')];

  /* page 1: the tools */
  const rowY = [300, 400, 500, 600, 700, 820];
  const p1 = page([
    underline(420, 730, 206, { color: BLUE, size: 2.2 }),
    hand(spline([[380, rowY[0] + 30], [300, rowY[0] + 5], [220, rowY[0] + 45], [140, rowY[0] + 10], [70, rowY[0] + 35]], 14), { color: INK, size: 3.2, style: 'fountain' }),
    hand(spline([[380, rowY[1] + 30], [300, rowY[1] + 5], [220, rowY[1] + 45], [140, rowY[1] + 10], [70, rowY[1] + 35]], 14), { color: BLUE, size: 2.6, style: 'ball' }),
    hand(spline([[380, rowY[2] + 30], [300, rowY[2] + 0], [220, rowY[2] + 50], [140, rowY[2] + 5], [70, rowY[2] + 40]], 14), { color: RED, size: 5, style: 'brush' }),
    hl(84, 372, rowY[3] + 22, '#ffe03d', 4),
    { tool: 'pen', style: 'ball', color: TEAL, size: 2.6, shape: 'auto', pts: ellipsePts(330, rowY[4] + 30, 42, 30) },
    { tool: 'pen', style: 'ball', color: ORANGE, size: 2.6, shape: 'auto', pts: [[200, rowY[4], .5], [260, rowY[4], .5], [260, rowY[4] + 60, .5], [200, rowY[4] + 60, .5], [200, rowY[4], .5]] },
    { tool: 'pen', style: 'ball', color: PURPLE, size: 2.6, shape: 'auto', pts: [[135, rowY[4], .5], [170, rowY[4] + 60, .5], [100, rowY[4] + 60, .5], [135, rowY[4], .5]] },
    box(70, rowY[5] - 14, 320, 84, { color: GREEN, size: 2 }),
    ...arrow(560, 1000, 420, 1060, { color: RED, size: 2.4 }),
    bulb(880, 980), bulb(940, 1040),
    star(900, 760, 22, { color: ORANGE, size: 2.4 }), star(940, 800, 14, { color: ORANGE, size: 2 }),
    ['قلم', 'تظليل', 'ممحاة', 'تحديد', 'أشكال', 'نص', 'صورة', 'ليزر', 'يد'].map((_, i) => underline(800, 950, 238 + i * 52, { color: i % 2 ? TEAL : BLUE, size: 1.4 })),
  ], [
    ...header('دليل الدفاتر', 1),
    T('أهلاً في دفترك ✍️', 730, 140, 640, 38, BLUE),
    T('هذا دفتر تعريفي مرسوم بأدوات مدار نفسها. حدّد أي شي فيه بأداة التحديد وحرّكه، أو امسحه بالممحاة، أو اكتب فوقه.', 730, 212, 660, 19, '#334155'),
    T('قلم حبر: سماكته تتغير مع الضغط والسرعة', 730, rowY[0] + 6, 300, 19),
    T('قلم جاف: خط ثابت ونظيف', 730, rowY[1] + 6, 300, 19),
    T('فرشاة: للعناوين والرسم', 730, rowY[2] + 6, 300, 19),
    T('قلم التظليل: يمر تحت الكتابة', 730, rowY[3] + 6, 300, 19),
    T('الفكرة المهمة تنظلل', 380, rowY[3] + 4, 290, 22, INK),
    T('أشكال: ارسم وثبّت قلمك لحظة، ويصير الشكل مضبوط', 730, rowY[4] + 6, 300, 19),
    T('نص: اضغط بأداة النص في أي مكان واكتب', 730, rowY[5] + 6, 300, 19),
    T('أنا مربع نص، اكتب فيني أو حرّكني', 380, rowY[5] + 8, 300, 20, GREEN),
    T('الأدوات', 960, 170, 200, 24, BLUE),
    ...['قلم', 'تظليل', 'ممحاة', 'تحديد', 'أشكال', 'نص', 'صورة', 'ليزر', 'يد'].map((t, i) => T('• ' + t, 960, 208 + i * 52, 200, 20, '#334155')),
    T('اضغط على الأداة اللي مختارها مرة ثانية، وتطلع لك إعداداتها: السماكة، وحدّة الرأس، وحساسية الضغط، وثبات الخط.', 960, 1160, 900, 21, '#334155'),
    T('وكل لون من الألوان الثلاثة اضغطه مرتين عشان تغيّره.', 960, 1240, 900, 21, '#334155'),
  ]);

  /* page 2: shortcuts */
  const keys = [['P', 'قلم'], ['H', 'قلم تظليل'], ['E', 'ممحاة'], ['L', 'تحديد'], ['S', 'أشكال'], ['T', 'نص'], ['K', 'مؤشر ليزر'], ['R', 'يد: للقراءة بدون كتابة'], ['مسافة', 'اضغطها مع أي أداة وحرّك الصفحة'], ['⌘Z', 'تراجع'], ['⇧⌘Z', 'إعادة'], ['⌘ + / −', 'تكبير وتصغير'], ['⌫', 'يحذف اللي محدّد']];
  const p2 = page([
    underline(420, 730, 206, { color: BLUE, size: 2.2 }),
    keys.map((_, i) => box(600, 238 + i * 62, 130, 46, { color: i < 8 ? BLUE : PURPLE, size: 1.8 })),
    keys.slice(0, 8).map((_, i) => hl(608, 722, 261 + i * 62, '#7cb6ff', 3.2)),
    ['قرص', 'سكرول', 'ثبّت', 'إصبعين'].map((_, i) => underline(800, 955, 246 + i * 150, { color: TEAL, size: 1.6 })),
    ...arrow(870, 870, 870, 940, { color: RED, size: 2 }),
    check(60, 1220, { color: GREEN }),
  ], [
    ...header('دليل الدفاتر', 2),
    T('اختصارات وحركات', 730, 140, 640, 38, BLUE),
    ...keys.flatMap(([k, d], i) => [T(k, 722, 246 + i * 62, 114, 20, i < 8 ? BLUE : PURPLE), T(d, 585, 246 + i * 62, 520, 20, '#334155')]),
    T('قرص التراكباد', 960, 210, 200, 20, TEAL), T('يكبّر ويصغّر لين 800% والكتابة تبقى حادة', 960, 252, 200, 16, '#475569'),
    T('سكرول', 960, 360, 200, 20, TEAL), T('ينقلك للصفحة اللي بعدها', 960, 402, 200, 16, '#475569'),
    T('ارسم وثبّت', 960, 510, 200, 20, TEAL), T('الخط المعوج يصير مستقيم، والدائرة تصير مضبوطة', 960, 552, 200, 16, '#475569'),
    T('نقرتين بإصبعين', 960, 660, 200, 20, TEAL), T('تراجع (على شاشات اللمس)', 960, 702, 200, 16, '#475569'),
    T('الدفتر يفتح على آخر صفحة كنت فيها', 960, 960, 200, 16, '#475569'),
    T('أداة التحديد ➰: ارسم دائرة حول أي كتابة، وبعدها اسحبها، أو كبّرها من الزاوية، أو غيّر لونها، أو كررها.', 900, 1160, 840, 21, '#334155'),
    T('كل صفحة لها قالب ولون تغيّرهم من زر «المزيد»، وتقدر تصدّر الدفتر كامل PDF.', 900, 1240, 840, 21, '#334155'),
  ]);

  /* page 3: a sample lesson summary */
  const p3 = page([
    underline(380, 720, 196, { color: BLUE, size: 2.2 }),
    oval(380, 430, 250, 165, { color: GREEN, size: 3.6, style: 'brush' }),
    oval(330, 410, 72, 62, { color: PURPLE, size: 2.8 }),
    hand(spline([[318, 400], [332, 392], [344, 404], [330, 418], [316, 408]], 8), { color: PURPLE, size: 5, style: 'brush' }),
    oval(480, 340, 42, 20, { color: ORANGE, size: 2.4 }), hand(spline([[445, 340], [460, 332], [475, 348], [490, 332], [512, 342]], 6), { color: ORANGE, size: 1.6 }),
    oval(470, 520, 40, 19, { color: ORANGE, size: 2.4 }), hand(spline([[437, 520], [452, 512], [467, 528], [482, 512], [500, 522]], 6), { color: ORANGE, size: 1.6 }),
    [[230, 480], [250, 500], [260, 470], [420, 470], [440, 450], [220, 380], [540, 430], [560, 455]].map(([x, y]) => oval(x, y, 3, 3, { color: '#2563eb', size: 2.5, style: 'ball' })),
    ...arrow(330, 340, 290, 255, { color: PURPLE, size: 1.8 }), box(170, 205, 140, 50, { color: PURPLE, size: 1.8 }),
    ...arrow(520, 330, 600, 250, { color: ORANGE, size: 1.8 }), box(560, 200, 180, 50, { color: ORANGE, size: 1.8 }),
    ...arrow(160, 470, 95, 560, { color: GREEN, size: 1.8 }), box(40, 560, 180, 50, { color: GREEN, size: 1.8 }),
    ...arrow(560, 455, 640, 560, { color: '#2563eb', size: 1.8 }), box(570, 560, 170, 50, { color: '#2563eb', size: 1.8 }),
    ...dashed(380, 600, 380, 650, { color: '#64748b', size: 1.4 }, 6), box(300, 650, 160, 46, { color: '#64748b', size: 1.6 }),
    hl(470, 700, 770, '#ffe03d'), hl(330, 575, 830, '#78e08a'), hl(520, 700, 890, '#7cb6ff'),
    star(722, 768, 11, { color: ORANGE, size: 2 }), star(722, 828, 11, { color: ORANGE, size: 2 }), star(722, 888, 11, { color: ORANGE, size: 2 }),
    line(60, 960, 720, 960, { color: INK, size: 1.6, style: 'ball' }), line(390, 960, 390, 1090, { color: INK, size: 1.6, style: 'ball' }), line(60, 1002, 720, 1002, { color: INK, size: 1.2, style: 'ball' }),
    check(640, 1018, { color: GREEN, size: 2.4 }), check(640, 1058, { color: GREEN, size: 2.4 }), line(250, 1030, 280, 1060, { color: RED, size: 2.4 }), line(280, 1030, 250, 1060, { color: RED, size: 2.4 }),
    ['النواة', 'الميتوكوندريا', 'الغشاء', 'الريبوسوم'].map((w, i) => hl(956 - w.length * 12.5, 958, 186 + i * 200, ['#c4b5fd', '#fdba74', '#86efac', '#93c5fd'][i], 3.6)),
    hl(500, 940, 1196, '#ffe03d'),
  ], [
    ...header('الأحياء · الوحدة الثالثة', 3),
    T('تركيب الخلية', 720, 128, 640, 38, BLUE),
    T('النواة', 300, 214, 120, 20, PURPLE), T('الميتوكوندريا', 735, 209, 170, 20, ORANGE), T('الغشاء الخلوي', 215, 569, 170, 20, GREEN), T('الريبوسومات', 735, 569, 160, 20, '#2563eb'), T('السيتوبلازم', 455, 659, 150, 18, '#475569'),
    T('الخلية أصغر وحدة حيّة تقدر تعيش لحالها', 700, 752, 640, 22),
    T('كل الكائنات الحية مكونة من خلية أو أكثر', 700, 812, 640, 22),
    T('الخلية تاخذ غذاء وتطلع طاقة وتنقسم', 700, 872, 640, 22),
    T('خلية نباتية', 710, 966, 300, 20, GREEN), T('خلية حيوانية', 380, 966, 300, 20, ORANGE),
    T('جدار خلوي وبلاستيدات', 625, 1014, 230, 18, '#334155'), T('فجوة كبيرة وحدة', 625, 1054, 230, 18, '#334155'),
    T('ما عندها جدار خلوي', 380, 1014, 300, 18, '#334155'), T('فجوات صغيرة كثيرة', 380, 1054, 300, 18, '#334155'),
    T('النواة', 960, 170, 200, 22, PURPLE), T('تحمل المادة الوراثية وتتحكم في نشاط الخلية', 960, 210, 200, 16, '#475569'),
    T('الميتوكوندريا', 960, 370, 200, 22, ORANGE), T('مصنع الطاقة في الخلية', 960, 410, 200, 16, '#475569'),
    T('الغشاء', 960, 570, 200, 22, GREEN), T('يحمي الخلية ويتحكم في دخول وخروج المواد', 960, 610, 200, 16, '#475569'),
    T('الريبوسوم', 960, 770, 200, 22, '#2563eb'), T('يصنع البروتينات', 960, 810, 200, 16, '#475569'),
    T('النواة تتحكم، والميتوكوندريا تعطي الطاقة، والغشاء يحمي. والخلية النباتية عندها جدار وبلاستيدات زيادة على الحيوانية.', 940, 1178, 860, 21, '#334155'),
  ]);

  /* page 4: quick review */
  const terms = ['النواة', 'الميتوكوندريا', 'الغشاء الخلوي', 'الريبوسوم', 'البلاستيدات', 'الفجوة'];
  const defs = ['مصنع الطاقة في الخلية', 'تخزّن الماء والمواد', 'تحمل المادة الوراثية', 'تصنع الغذاء بالبناء الضوئي', 'يصنع البروتينات', 'يحمي الخلية'];
  const match = [2, 0, 5, 4]; // the first four lines are already drawn; the rest is for you
  const termColors = ['#c4b5fd', '#fdba74', '#86efac', '#93c5fd', '#fde68a', '#fbcfe8'], lineColors = [PURPLE, ORANGE, GREEN, '#2563eb'];
  const p4 = page([
    underline(420, 720, 206, { color: BLUE, size: 2.2 }),
    terms.map((_, i) => [box(770, 250 + i * 104, 190, 62, { color: BLUE, size: 2 }), hl(780, 950, 281 + i * 104, termColors[i], 5.4)]),
    defs.map((_, i) => box(650, 262 + i * 104, 30, 30, { color: '#64748b', size: 1.8 })),
    match.map((d, i) => line(770, 281 + i * 104, 682, 277 + d * 104, { color: lineColors[i], size: 2, style: 'ball' })),
    box(60, 930, 420, 230, { color: PURPLE, size: 2 }),
    dashedBox(520, 930, 420, 230, { color: GREEN, size: 1.8 }),
  ], [
    ...header('الأحياء · الوحدة الثالثة', 4),
    T('مراجعة سريعة', 720, 140, 640, 38, BLUE),
    T('وصّل كل مصطلح بتعريفه. وصّلت لك أول أربعة، والباقي عليك ✍️', 720, 200, 660, 18, '#475569'),
    ...terms.map((t, i) => T(t, 950, 264 + i * 104, 170, 22, BLUE)),
    ...defs.map((t, i) => T(t, 635, 266 + i * 104, 560, 20, '#334155')),
    T('اشرح بكلامك:', 470, 950, 390, 20, PURPLE), T('ليش الخلية النباتية تحتاج جدار خلوي والحيوانية لا؟', 470, 1000, 390, 22, INK),
    T('الجواب (غطّه بشكل وجرّب نفسك):', 930, 950, 390, 20, GREEN), T('النبات ما يتحرك، فيحتاج جدار قوي يعطيه شكل ثابت ويحميه. والحيوان يتحرك ويحتاج خلايا مرنة.', 930, 1000, 390, 20, GREEN),
    T('نصيحة: سوّ صفحات مراجعة مثل هذي في آخر كل درس.', 940, 1250, 860, 20, '#334155'),
  ]);

  /* page 5: your turn */
  const p5 = page([
    underline(480, 720, 206, { color: BLUE, size: 2.2 }),
    ...arrow(620, 330, 520, 420, { color: RED, size: 2.4 }),
    bulb(120, 260),
  ], [
    ...header('دليل الدفاتر', 5),
    T('دورك ✍️', 720, 140, 640, 38, BLUE),
    T('جرّب القلم هنا. وإذا خلصت، سوّ دفتر جديد من الرف واختر قالب يناسبك: مسطّر، مربعات، كورنيل، ملخص دراسي، أو واحد من المخططات.', 720, 220, 640, 20, '#334155'),
  ]);

  return { id: uid(), kind: 'notebook', name: 'دليل الدفاتر', color: '#1e3a8a', paper: 'study', paperColor: 'white', fav: true, created: Date.now(), opened: Date.now(), pages: [p1, p2, p3, p4, p5] };
}

/* add the guides once, for new and existing users alike */
function addOnboarding(st) {
  if ((st.onboarding || 0) >= 2) return false;
  if (!st.pages.some(p => p.title === 'دليل الملاحظات')) st.pages.push(...guidePages());
  if (!st.notebooks.some(n => n.name === 'دليل الدفاتر')) st.notebooks.unshift(sampleNotebook());
  st.onboarding = 2;
  return true;
}
