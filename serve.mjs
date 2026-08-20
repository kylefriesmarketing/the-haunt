/* THE HAUNT — serve.mjs — a static server for dev.html (the single file works from file://,
   but the dev shell needs http for node_modules/three). `node serve.mjs 8478` */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize, dirname } from 'path';
import { fileURLToPath } from 'url';

const port = +process.argv[2] || 8478;
const root = dirname(fileURLToPath(import.meta.url));   // the barn, wherever it was launched from
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.md': 'text/plain; charset=utf-8'
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    /* dev shot receiver: the page renders itself and POSTs a dataURL here (see View.shot) */
    if (req.method === 'POST' && p === '/shot') {
      const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^\w.-]/g, '');
      let body = '';
      for await (const chunk of req) body += chunk;
      const b64 = body.slice(body.indexOf(',') + 1);
      const { mkdir, writeFile } = await import('fs/promises');
      await mkdir(join(root, 'shots'), { recursive: true });
      await writeFile(join(root, 'shots', name + '.png'), Buffer.from(b64, 'base64'));
      res.writeHead(200, { 'content-type': 'text/plain' }).end('shots/' + name + '.png');
      console.log('wrote shots/' + name + '.png');
      return;
    }
    if (p === '/') p = '/index.html';
    const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(root)) { res.writeHead(403).end('nope'); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500).end(String(e.message));
  }
}).listen(port, () => console.log(`the barn is serving on http://localhost:${port}/  (dev shell: /dev.html)`));
