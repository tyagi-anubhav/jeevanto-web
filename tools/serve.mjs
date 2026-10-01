// Serves dist/ the way GitHub Pages does: /circle → circle.html, unknown → 404.html with status 404.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const ROOT = new URL('../dist/', import.meta.url).pathname, PORT = Number(process.env.PORT || 4321);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.txt': 'text/plain', '.json': 'application/json' };
async function file(p) { try { const s = await stat(p); return s.isFile() ? p : null; } catch { return null; } }
createServer(async (req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = normalize(join(ROOT, u));
  if (!base.startsWith(ROOT.replace(/\/$/, ''))) { res.writeHead(400); return res.end(); }
  let p = await file(base) || await file(base + '.html') || (u.endsWith('/') ? await file(join(base, 'index.html')) : null);
  let code = 200; if (!p) { p = join(ROOT, '404.html'); code = 404; }
  const body = await readFile(p);
  const type = TYPES[extname(p)] || 'application/octet-stream';
  // Range requests, so <video> behaves as it does on Pages
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range && code === 200) { const s = range[1] ? +range[1] : 0, e = range[2] ? +range[2] : body.length - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s}-${e}/${body.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 }); return res.end(body.subarray(s, e + 1)); }
  res.writeHead(code, { 'Content-Type': type, 'Content-Length': body.length, 'Accept-Ranges': 'bytes' }); res.end(body);
}).listen(PORT, '127.0.0.1', () => console.log('serving dist on http://127.0.0.1:' + PORT));
