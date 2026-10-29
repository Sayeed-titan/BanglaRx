#!/usr/bin/env node
/**
 * Design-system guard. Runs before every build (npm run build) and on demand:
 *
 *   npm run check:ds              check everything
 *   npm run check:ds -- --update  lock in progress after you migrated a screen
 *
 * What it protects:
 *   1. TOKENS      every text/background pair meets WCAG contrast in light AND dark,
 *                  tap targets are 44px or more, the smallest text is 13px or more,
 *                  dark mode never leaks into print.
 *   2. SCREENS     no new hard-coded colours, tiny fonts, old palette names, old class
 *                  names or removed focus rings. Existing debt is recorded in
 *                  src/design-system/baseline.json and may only go DOWN (a ratchet).
 *                  Files inside design-system/ must have zero violations.
 *   3. GALLERY     every exported component appears in Preview.tsx (?ds), so nobody
 *                  ships a component that was never looked at.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DS = join(SRC, 'design-system');
const BASELINE = join(DS, 'baseline.json');
const update = process.argv.includes('--update');

const failures = [];
const notes = [];
const fail = (msg) => failures.push(msg);

/* ======================= 1. TOKENS ======================= */

const tokensCss = readFileSync(join(DS, 'tokens.css'), 'utf8');

function declarations(block) {
  const out = {};
  for (const m of block.matchAll(/--(rx-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const lightBlock = tokensCss.match(/:root,\s*\.rx,\s*\.rx-paper\s*\{([\s\S]*?)\n\}/);
const darkBlock = tokensCss.match(/@media not print\s*\{\s*:root\[data-theme='dark'\],\s*\.rx\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}\s*\}/);
if (!lightBlock) fail('tokens.css: light token block (:root, .rx, .rx-paper) not found');
if (!darkBlock) fail("tokens.css: dark block must sit inside '@media not print' so printed prescriptions stay light");

const light = lightBlock ? declarations(lightBlock[1]) : {};
const dark = { ...light, ...(darkBlock ? declarations(darkBlock[1]) : {}) };

const COLOR_KEYS = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container', 'bg', 'surface', 'surface-2', 'surface-3',
  'ink', 'ink-2', 'ink-3', 'outline', 'accent', 'on-accent', 'success', 'on-success', 'success-solid',
  'attention', 'on-attention', 'danger', 'on-danger', 'danger-solid', 'info', 'on-info',
];
for (const k of COLOR_KEYS) {
  if (!light[`rx-${k}`]) fail(`tokens.css: --rx-${k} missing in light theme`);
  if (darkBlock && !declarations(darkBlock[1])[`rx-${k}`]) fail(`tokens.css: --rx-${k} not set for dark theme`);
}

// ---- tiny colour engine: hex, var(), color-mix(in srgb, A p%, B)
function splitTop(str) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}
function parseHex(h) {
  let x = h.replace('#', '');
  if (x.length === 3) x = x.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
}
function resolve(value, vars, depth = 0) {
  if (depth > 12) throw new Error(`token cycle near ${value}`);
  const v = value.trim();
  if (v.startsWith('#')) return parseHex(v);
  const ref = v.match(/^var\(--(rx-[a-z0-9-]+)\)$/);
  if (ref) {
    if (!vars[ref[1]]) throw new Error(`unknown token ${ref[1]}`);
    return resolve(vars[ref[1]], vars, depth + 1);
  }
  const mix = v.match(/^color-mix\(in srgb,([\s\S]*)\)$/);
  if (mix) {
    const [a, b] = splitTop(mix[1]);
    const am = a.match(/^([\s\S]+?)\s+(\d+(?:\.\d+)?)%$/);
    if (!am) throw new Error(`cannot read color-mix: ${v}`);
    const p = Number(am[2]) / 100;
    const ca = resolve(am[1], vars, depth + 1);
    const cb = resolve(b, vars, depth + 1);
    return ca.map((c, i) => c * p + cb[i] * (1 - p));
  }
  throw new Error(`cannot resolve ${v}`);
}
function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text token, background token, minimum ratio]. Text must reach 4.5:1 (WCAG AA).
const PAIRS = [
  ['ink', 'bg'], ['ink', 'surface'], ['ink', 'surface-2'], ['ink', 'surface-3'],
  ['ink-2', 'bg'], ['ink-2', 'surface'], ['ink-2', 'surface-2'],
  ['ink-3', 'bg'], ['ink-3', 'surface'], ['ink-3', 'surface-2'], ['ink-3', 'surface-3'],
  ['on-primary', 'primary'], ['on-primary-container', 'primary-container'],
  ['primary', 'surface'], ['primary', 'bg'], ['primary', 'surface-2'],
  ['on-accent', 'accent'], ['on-success', 'success'], ['on-danger', 'danger'],
  ['on-attention', 'attention'], ['on-info', 'info'],
  ['danger-solid', 'surface'], ['danger-solid', 'bg'], ['success-solid', 'surface'],
];
if (lightBlock) {
  for (const [name, vars] of [['light', light], ['dark', dark]]) {
    for (const [fg, bg] of PAIRS) {
      try {
        const ratio = contrast(resolve(`var(--rx-${fg})`, vars), resolve(`var(--rx-${bg})`, vars));
        if (ratio < 4.5) fail(`contrast ${name}: --rx-${fg} on --rx-${bg} is ${ratio.toFixed(2)}:1, needs 4.5:1`);
      } catch (e) {
        fail(`contrast ${name}: ${fg} on ${bg}: ${e.message}`);
      }
    }
  }
}

const px = (v) => Number.parseFloat(String(v ?? '').replace('px', ''));
if (px(light['rx-tap']) < 44) fail(`tokens.css: --rx-tap must be at least 44px (is ${light['rx-tap']})`);
if (px(light['rx-fs-caption']) < 13) fail(`tokens.css: --rx-fs-caption must be at least 13px (is ${light['rx-fs-caption']})`);
if (px(light['rx-fs-body']) < 16) fail(`tokens.css: --rx-fs-body must be at least 16px (is ${light['rx-fs-body']})`);

// ---- every interactive component must be at least 44px tall (or extend its hit area to 44px)
const componentsCss = readFileSync(join(DS, 'components.css'), 'utf8');
function evalSize(expr) {
  const e = expr.trim();
  let m;
  if ((m = e.match(/^(-?[\d.]+)px$/))) return Number(m[1]);
  if ((m = e.match(/^var\(--(rx-[a-z0-9-]+)\)$/))) return light[m[1]] ? evalSize(light[m[1]]) : NaN;
  if ((m = e.match(/^max\(([\s\S]+)\)$/))) return Math.max(...splitTop(m[1]).map(evalSize));
  if ((m = e.match(/^calc\((.+?)\s*([+-])\s*([\d.]+)px\)$/))) return evalSize(m[1]) + (m[2] === '+' ? 1 : -1) * Number(m[3]);
  return NaN;
}
const TAP_CLASSES = ['rx-btn', 'rx-iconbtn', 'rx-chip', 'rx-seg__opt', 'rx-switch', 'rx-result', 'rx-mic'];
for (const cls of TAP_CLASSES) {
  const rule = componentsCss.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`));
  if (!rule) { fail(`components.css: .${cls} rule not found (tap-size check)`); continue; }
  const sizes = [...rule[1].matchAll(/(?:^|[;\s])(min-height|height)\s*:\s*([^;]+);/g)].map((m) => evalSize(m[2]));
  const size = sizes.length ? Math.max(...sizes) : NaN;
  const extended = new RegExp(`\\.${cls}::before\\s*\\{[^}]*inset`).test(componentsCss);
  if (!(size >= 44) && !extended) fail(`components.css: .${cls} is ${Number.isNaN(size) ? 'of unknown height' : size + 'px'}, tap targets must be 44px or more (or extend the hit area with ::before)`);
}

/* ======================= 2. SCREENS (ratchet) ======================= */

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const RULES = {
  'hard-coded-color': { re: /#[0-9a-fA-F]{3,8}\b/g, hint: 'use a --rx-* token' },
  'color-function': { re: /\b(?:rgba?|hsla?)\(/g, hint: 'use color-mix() on --rx-* tokens' },
  'old-palette': { re: /var\(--(?:slate|teal|sapphire|crimson|amber|emerald)-\d+\)/g, hint: 'use --rx-* tokens' },
  'old-class': { re: /\b(?:btn-clinical|btn-primary-teal|btn-primary-slate|btn-secondary|btn-outline|btn-danger|clinical-card|badge-clinical|input-clinical|select-clinical|textarea-clinical)\b/g, hint: 'use the components from design-system' },
  'tiny-font': { custom: 'font', hint: 'text must be 13px (0.8125rem) or larger' },
  'focus-removed': { re: /outline\s*:\s*['"]?none/g, hint: 'never remove the focus ring' },
};

function tinyFonts(text) {
  let n = 0;
  for (const m of text.matchAll(/font-?[sS]ize\s*:\s*['"`]?\s*([0-9.]+)\s*(rem|px|pt|em|%)?/g)) {
    const val = Number(m[1]);
    const unit = m[2];
    // em is measured against the smallest base we use (the 14px prescription sheet); pt is print and not checked
    const pxSize = unit === 'rem' ? val * 16 : unit === 'em' ? val * 14 : val;
    if (pxSize > 0 && pxSize < 13 && (unit === 'rem' || unit === 'px' || unit === 'em' || (!unit && val > 3))) n++;
  }
  return n;
}

const counts = {};
for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split(sep).join('/');
  if (rel.startsWith('assets/') || rel === 'design-system/baseline.json') continue;
  const inDs = rel.startsWith('design-system/');
  const isCss = file.endsWith('.css');
  const text = strip(readFileSync(file, 'utf8'));
  for (const [rule, def] of Object.entries(RULES)) {
    // the design system's own stylesheets are where raw colours legitimately live
    if (inDs && isCss && ['hard-coded-color', 'color-function'].includes(rule)) continue;
    // legacy.css exists to carry the old class and palette names
    if (rel === 'design-system/legacy.css' && ['old-palette', 'old-class'].includes(rule)) continue;
    // old class definitions inside css files are the system's own, not usage
    if (inDs && isCss && rule === 'old-class') continue;
    const n = def.custom === 'font' ? tinyFonts(text) : (text.match(def.re) || []).length;
    if (n > 0) (counts[rule] ??= {})[rel] = n;
  }
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
let improved = 0;
for (const [rule, files] of Object.entries(counts)) {
  for (const [rel, n] of Object.entries(files)) {
    if (rel.startsWith('design-system/')) {
      fail(`${rel}: ${n} x ${rule} (${RULES[rule].hint}). Files inside design-system/ must have none.`);
      continue;
    }
    const allowed = baseline[rule]?.[rel] ?? 0;
    if (n > allowed) fail(`${rel}: ${n} x ${rule}, allowed ${allowed} (${RULES[rule].hint})`);
    else if (n < allowed) improved += allowed - n;
  }
}
for (const [rule, files] of Object.entries(baseline)) {
  for (const [rel, allowed] of Object.entries(files)) {
    if (!(counts[rule]?.[rel])) improved += allowed;
  }
}
if (improved > 0 && !update) notes.push(`${improved} legacy violation(s) fixed since the baseline. Run: npm run check:ds -- --update`);

const debtTotal = Object.values(counts).reduce((s, f) => s + Object.entries(f).filter(([r]) => !r.startsWith('design-system/')).reduce((a, [, n]) => a + n, 0), 0);

/* ======================= 3. GALLERY ======================= */

const indexTs = readFileSync(join(DS, 'index.ts'), 'utf8');
const preview = readFileSync(join(DS, 'Preview.tsx'), 'utf8');
const NOT_COMPONENTS = new Set(['initPrefs', 'applyPrefs', 'usePrefs', 'NOT_RECORDED', 'Equalizer']);
for (const line of indexTs.split('\n')) {
  if (!line.startsWith('export {')) continue;
  for (const name of line.match(/\{([^}]+)\}/)[1].split(',').map((s) => s.trim())) {
    if (NOT_COMPONENTS.has(name) || !/^[A-Z]/.test(name)) continue;
    if (!new RegExp(`<${name}[\\s>/]`).test(preview)) fail(`Preview.tsx: component <${name}> is exported but not shown in the gallery`);
  }
}

/* ======================= report ======================= */

if (update) {
  if (failures.some((f) => f.startsWith('tokens.css') || f.startsWith('contrast') || f.startsWith('Preview.tsx') || f.includes('must have none'))) {
    console.error('Cannot update the baseline while token, gallery or design-system errors exist:');
    for (const f of failures) console.error('  x ' + f);
    process.exit(1);
  }
  const next = {};
  for (const [rule, files] of Object.entries(counts)) {
    for (const [rel, n] of Object.entries(files)) {
      if (rel.startsWith('design-system/')) continue;
      const prev = baseline[rule]?.[rel];
      // the baseline may only shrink, except the first time it is created
      (next[rule] ??= {})[rel] = Object.keys(baseline).length === 0 || prev === undefined ? n : Math.min(n, prev);
    }
  }
  writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n');
  console.log(`Baseline written: ${debtTotal} legacy violation(s) recorded in ${relative(ROOT, BASELINE)}.`);
  process.exit(0);
}

for (const n of notes) console.log('note: ' + n);
if (failures.length) {
  console.error(`\nDesign-system check FAILED (${failures.length}):`);
  for (const f of failures) console.error('  x ' + f);
  console.error('\nFix the screen, or if the design itself changed, update tokens.css and the canvas together. See src/design-system/README.md.');
  process.exit(1);
}
console.log(`Design-system check passed. Contrast OK in light and dark, ${debtTotal} legacy violation(s) remaining (target 0).`);
