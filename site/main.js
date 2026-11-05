'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

// the download buttons point at the newest release's files
fetch('https://api.github.com/repos/tuwra/madar/releases/latest').then(r => (r.ok ? r.json() : null)).then(rel => {
  if (!rel) return;
  const v = rel.tag_name.replace(/^v/, '');
  $$('[data-version]').forEach(el => { el.textContent = `الإصدار ${v}`; });
  $$('[data-version-long]').forEach(el => { el.textContent = `الإصدار ${v}، ${new Date(rel.published_at).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })}`; });
  for (const a of $$('[data-asset]')) {
    const f = rel.assets.find(x => x.name.endsWith('.' + a.dataset.asset));
    if (f) a.href = f.browser_download_url;
  }
}).catch(() => { /* the buttons still lead to the releases page */ });

// the main button suits the device it's opened on
const ua = navigator.userAgent, touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
const os = /iPhone|iPad|iPod|Android/.test(ua) || touchMac ? 'ios' : /Windows/.test(ua) ? 'win' : /Macintosh/.test(ua) ? 'mac' : 'web';
const cta = $('#cta-main');
if (os === 'mac' || os === 'win') {
  cta.querySelector('span').textContent = os === 'mac' ? 'حمّله للماك' : 'حمّله للويندوز';
  cta.addEventListener('click', e => {
    const a = $(`[data-os="${os}"] [data-asset]`);
    if (a.href.includes('/download/')) { e.preventDefault(); location.href = a.href; }
  });
} else if (os === 'ios') {
  cta.querySelector('span').textContent = 'افتح مدار';
  cta.href = 'app/';
}
$(`.dl-card[data-os="${os}"]`)?.classList.add('mine');

// sections fade in as they come into view
if (matchMedia('(prefers-reduced-motion: no-preference)').matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('anim');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(el => io.observe(el));
}
// the header gets a background once the page scrolls
const header = $('#top');
const onScroll = () => header.classList.toggle('scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
