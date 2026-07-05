/* build-preview.js — bundle the whole app into ONE self-contained HTML file
   (inline JS, CSS, base64 fonts) for hosted previews where only a single
   page can be served. Identification runs the in-page demo engine and the
   UI labels it as demo mode.
   Usage: node test/build-preview.js [outPath]                          */

import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = process.argv[2] || root + 'test/tmp/field-journal-preview.html';

// 1. bundle all JS (dynamic imports inlined by iife format)
const result = await build({
  entryPoints: [root + 'js/app.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: ['es2020'],
});
const js = result.outputFiles[0].text;

// 2. CSS with fonts embedded as data URIs
const fontFiles = {
  "'Caveat';400": 'caveat-400.woff2',
  "'Caveat';600": 'caveat-600.woff2',
  "'Caveat';700": 'caveat-700.woff2',
  "'Alegreya';400": 'alegreya-400.woff2',
  "'Alegreya';500": 'alegreya-500.woff2',
  "'Alegreya';700": 'alegreya-700.woff2',
};
let fontCSS = '';
for (const [spec, file] of Object.entries(fontFiles)) {
  const [fam, weight] = spec.split(';');
  const b64 = (await readFile(root + 'fonts/' + file)).toString('base64');
  fontCSS += `@font-face{font-family:${fam};font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2')}\n`;
}
const italic = (await readFile(root + 'fonts/alegreya-400-italic.woff2')).toString('base64');
fontCSS += `@font-face{font-family:'Alegreya';font-style:italic;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${italic}) format('woff2')}\n`;

const css = (await readFile(root + 'css/journal.css', 'utf8'))
  .replace(/@import url\('\.\.\/fonts\/fonts\.css'\);/, '');

// 3. single HTML page (content only — host wraps in doctype/head/body)
const html = `<title>Field Journal — watercolor bird diary (preview)</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>${fontCSS}${css}
/* hosted-preview niceties: page fills the frame */
html,body{height:100%}
</style>
<div id="app"></div>
<nav id="nav" class="nav" aria-label="Main"></nav>
<div id="overlay-root"></div>
<script>window.__DEMO_LOCAL__ = true;</script>
<script>${js}</script>
`;

await writeFile(out, html);
console.log('wrote', out, Math.round(html.length / 1024) + 'KB');
