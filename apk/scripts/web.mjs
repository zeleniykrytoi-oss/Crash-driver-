// Copies the game into www/index.html for the app. With a network connection it also downloads the Google
// Fonts the menus use (Exo 2, Russo One, JetBrains Mono; SIL Open Font License) into www/fonts, so the app
// shows them offline; without one the page keeps the online link and falls back to system fonts offline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.resolve(root, '..', 'Physical.DeformZ.html');
const www = path.join(root, 'www');
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, 'fonts'), { recursive: true });
let html = fs.readFileSync(src, 'utf8');

const link = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)">/);
if (link) {
  try {
    // a current browser's user agent gets woff2 files split by script (latin, cyrillic, ...)
    const ua = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
    let css = await (await fetch(link[1].replace(/&amp;/g, '&'), { headers: { 'user-agent': ua } })).text();
    const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])];
    if (!urls.length) throw new Error('no font files in the stylesheet');
    let i = 0;
    for (const u of urls) {
      const name = `f${i++}${path.extname(new URL(u).pathname) || '.woff2'}`;
      const res = await fetch(u);
      if (!res.ok) throw new Error(`${res.status} for ${u}`);
      fs.writeFileSync(path.join(www, 'fonts', name), Buffer.from(await res.arrayBuffer()));
      css = css.split(u).join(name);
    }
    fs.writeFileSync(path.join(www, 'fonts', 'fonts.css'), css);
    html = html
      .replace(link[0], '<link rel="stylesheet" href="fonts/fonts.css">')
      .replace(/<link rel="preconnect" href="https:\/\/fonts\.g[^"]+"( crossorigin)?>\n?/g, '');
    console.log(`fonts: ${urls.length} files saved to www/fonts`);
  } catch (e) {
    console.warn(`fonts: kept the online link (${e.message})`);
  }
}
fs.writeFileSync(path.join(www, 'index.html'), html);
console.log(`www/index.html: ${(html.length / 1048576).toFixed(1)} MB`);
