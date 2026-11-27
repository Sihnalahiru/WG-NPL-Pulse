import fs from 'fs';
const distDir = process.argv[2] || 'dist';
let html = fs.readFileSync(`${distDir}/index.html`, 'utf8');
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/, (m, src) => {
  const p = src.startsWith('/') ? src.slice(1) : src;
  return `<script>${fs.readFileSync(`${distDir}/${p}`, 'utf8')}</script>`;
});
const { JSDOM, VirtualConsole } = await import('jsdom');
const vc = new VirtualConsole();
vc.on('jsdomError', e => console.log('JSDOM ERROR:', (e.detail?.stack || e.stack || e.message || String(e)).split('\n').slice(0,6).join('\n')));
vc.on('error', (...a) => console.log('CONSOLE ERROR:', a.map(String).slice(0,3)));
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
setTimeout(() => {
  const root = dom.window.document.getElementById('root');
  console.log('APP READY:', root?.dataset?.appReady);
  process.exit(root?.dataset?.appReady === 'true' ? 0 : 1);
}, 6000);
