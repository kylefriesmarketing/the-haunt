/* THE HAUNT — build.mjs — concatenates everything into the-haunt.html (single file, double-clickable, MY BREW style).
   node build.mjs */
import { readFileSync, writeFileSync } from 'fs';

const parts = ['rng.js', 'data.js', 'audio.js', 'sim.js', 'barn3d.js', 'replay.js', 'net.js', 'view.js', 'player.js', 'ui.js', 'game.js'];
const three = readFileSync('node_modules/three/build/three.min.js', 'utf8');
const code = parts.map(p => `/* ===== parts/${p} ===== */\n` + readFileSync('parts/' + p, 'utf8')).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>THE HAUNT — the scream barn · a DIRTY BOY DEVS game</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#070510}canvas{display:block}</style>
</head>
<body>
<canvas id="game"></canvas>
<script>${three}</script>
<script>${code}</script>
</body>
</html>
`;
writeFileSync('the-haunt.html', html);
writeFileSync('index.html', html);   // index.html IS the game — GitHub Pages serves it at the clean URL
console.log('built the-haunt.html + index.html —', (html.length / 1024).toFixed(0) + 'KB');
