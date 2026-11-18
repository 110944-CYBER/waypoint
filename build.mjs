// Bundles src/ into site.html (artifact page, no document skeleton) and index.html (standalone file).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(here, 'src', f), 'utf8');

const dark = src('tokens-dark.css').trim();
const css = src('styles.css').split('/*@@DARK@@*/').join(dark);
const js = ['icons.js', 'data.js', 'engine.js', 'core.js', 'ui.js', 'photo-credits.js', 'photos.js', 'compass.js', 'pro.js', 'landing.js', 'onboard.js', 'app.js']
  .map((f) => `/* ---- ${f} ---- */\n${src(f)}`).join('\n');

const FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:wght@500..800&family=Atkinson+Hyperlegible+Next:wght@400..800&display=swap';
const PREACT = 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.umd.js';

const head = `<title>Waypoint</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Waypoint matches students and graduates to scholarships, internships, job shadowing and postgraduate programs, and shows exactly what each one needs.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>
${css}
</style>`;

const body = `<div id="app"></div>
<noscript><p style="padding:24px;font:16px system-ui">Waypoint needs JavaScript to run.</p></noscript>
<script src="${PREACT}"></script>
<script>
(function () {
'use strict';
${js}
})();
</script>`;

writeFileSync(join(here, 'site.html'), `${head}\n${body}\n`);
writeFileSync(join(here, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head}
</head>
<body>
${body}
</body>
</html>
`);
writeFileSync(join(here, '.bundle-check.js'), `(function(){\n${js}\n})();\n`);
console.log('built site.html', (Buffer.byteLength(head + body) / 1024).toFixed(1) + ' KB');
