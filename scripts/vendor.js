// Copies the browser builds of the libraries the app uses into src/vendor,
// so the app works fully offline.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = p => path.join(root, 'node_modules', p);
const out = path.join(root, 'src', 'vendor');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const copy = (from, to) => fs.cpSync(nm(from), path.join(out, to), { recursive: true });
copy('pdfjs-dist/build/pdf.min.js', 'pdf.min.js');
copy('pdfjs-dist/build/pdf.worker.min.js', 'pdf.worker.min.js');
copy('@highlightjs/cdn-assets/highlight.min.js', 'highlight.min.js');
copy('jspdf/dist/jspdf.umd.min.js', 'jspdf.umd.min.js');
copy('katex/dist/katex.min.js', 'katex/katex.min.js');
copy('katex/dist/katex.min.css', 'katex/katex.min.css');
copy('katex/dist/fonts', 'katex/fonts');

// IBM Plex Sans Arabic, Arabic + Latin subsets
fs.mkdirSync(path.join(out, 'fonts'));
let css = '';
for (const w of [400, 500, 600, 700]) {
  for (const sub of ['arabic', 'latin']) {
    const file = `ibm-plex-sans-arabic-${sub}-${w}-normal.woff2`;
    copy(`@fontsource/ibm-plex-sans-arabic/files/${file}`, `fonts/${file}`);
    css += `@font-face{font-family:'IBM Plex Sans Arabic';font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${file}) format('woff2');${sub === 'latin' ? 'unicode-range:U+0000-00FF,U+2000-206F;' : ''}}\n`;
  }
}
fs.writeFileSync(path.join(out, 'fonts.css'), css);
console.log('vendor files ready in src/vendor');
