#!/usr/bin/env node
// Empaqueta el juego en un solo HTML (dist/balam-beat.html).
// Ese archivo se abre con doble clic, sin servidor, e incluye las
// canciones originales. Para canciones propias usa la carpeta web/ con servidor.

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const result = await build({
  entryPoints: ['web/js/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('web/css/style.css', 'utf8').replace(/@font-face\s*{[^}]*}/, '');

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Balam Beat</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
<style>${css}</style>
</head>
<body>
<canvas id="game" aria-label="Balam Beat, juego de ritmo"></canvas>
<script>${js}</script>
</body>
</html>
`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/balam-beat.html', html);
console.log(`✔ dist/balam-beat.html (${(html.length / 1024).toFixed(0)} KB)`);

// Versión para publicar como página web (sin esqueleto HTML propio)
if (process.argv.includes('--artifact')) {
  const page = `<title>Balam Beat</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
<style>
:root { --night: #140A2B; --void: #05020C; color-scheme: dark; }
html, body { height: 100%; margin: 0; background: var(--void); overflow: hidden; }
body { display: flex; align-items: center; justify-content: center; }
canvas { display: block; background: var(--night); max-width: 100%; }
</style>
<canvas id="game" aria-label="Balam Beat, juego de ritmo"></canvas>
<script>${js}</script>
`;
  writeFileSync('dist/artifact.html', page);
  console.log('✔ dist/artifact.html');
}
