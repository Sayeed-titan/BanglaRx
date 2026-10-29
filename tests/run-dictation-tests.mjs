// Runs dictation-cases.json through the live /api/ai/analyze-consultation and scores the result.
// Usage: node tests/run-dictation-tests.mjs [apiBase] [--only=id1,id2] [--delay=ms]
import fs from 'node:fs';

const API = process.argv.find(a => a.startsWith('http')) || 'http://localhost:5000/api';
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const delay = Number((process.argv.find(a => a.startsWith('--delay=')) || '--delay=4500').slice(8));
const cases = JSON.parse(fs.readFileSync(new URL('./dictation-cases.json', import.meta.url), 'utf8'))
  .filter(c => !only.length || only.includes(c.id));

const toAscii = s => String(s ?? '').replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
const normDose = s => toAscii(s).toLowerCase().replace(/\s/g, '');
const isSos = s => /sos|prn|জ্বর আসলে|জর আসলে|jor hole|if fever|needed/i.test(s || '');
const daysOf = s => {
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, fourteen: 14 };
  const t = toAscii(s).toLowerCase().replace(/\b(one|two|three|four|five|six|seven|ten|fourteen)\b/g, w => words[w]);
  const n = parseFloat((t.match(/\d+(\.\d+)?/) || [])[0]);
  if (/continue|চলবে|cholbe/.test(t)) return 'continue';
  if (!n) return null;
  if (/month|মাস/.test(t)) return Math.round(n * 30);
  if (/week|সপ্তাহ/.test(t)) return n * 7;
  return n;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rows = [];
for (const c of cases) {
  const t0 = Date.now();
  let res;
  let err = null;
  try {
    const r = await fetch(`${API}/ai/analyze-consultation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: c.say })
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    res = await r.json();
  } catch (e) {
    err = String(e.message || e);
  }
  const ms = Date.now() - t0;

  const row = { id: c.id, ms, err, medOk: 0, medTotal: c.meds.length, doseOk: 0, doseTotal: 0, daysOk: 0, daysTotal: 0, notes: [] };
  if (!err) {
    const got = res.medicines || [];
    for (const exp of c.meds) {
      const want = exp.brand.toLowerCase();
      const m = got.find(g => {
        const b = (g.brandName || '').toLowerCase();
        return b.includes(want) || want.includes(b.split(' ')[0]) && b.length > 2;
      });
      if (!m) { row.notes.push(`missing ${exp.brand}`); continue; }
      if (exp.expectUnmatched) {
        if (m.matchStatus === 'unmatched') row.medOk++; else row.notes.push(`${exp.brand} should be unmatched`);
      } else if (m.matchStatus === 'exact' || (exp.allowAmbiguous && ['ambiguous', 'fuzzy', 'strength_unavailable'].includes(m.matchStatus))) {
        row.medOk++;
      } else {
        row.notes.push(`${exp.brand} status=${m.matchStatus}`);
      }
      if (exp.dose) {
        row.doseTotal++;
        const ok = exp.dose === 'SOS' ? isSos(m.dosagePattern) : normDose(m.dosagePattern) === exp.dose;
        if (ok) row.doseOk++; else row.notes.push(`${exp.brand} dose "${m.dosagePattern}" != ${exp.dose}`);
      }
      if (exp.days) {
        row.daysTotal++;
        if (daysOf(m.duration) === exp.days) row.daysOk++; else row.notes.push(`${exp.brand} duration "${m.duration}" != ${exp.days}d`);
      }
    }
    if (got.length > c.meds.length) row.notes.push(`extra meds: ${got.slice(c.meds.length).map(g => g.brandName).join(',')}`);
    for (const t of c.tests || []) {
      if (!(res.investigations || []).some(i => i.toLowerCase().includes(t.toLowerCase()))) row.notes.push(`missing test ${t}`);
    }
    if (c.vitals?.bp && !(res.vitals?.bp || '').replace(/\s/g, '').includes(c.vitals.bp)) row.notes.push(`vitals bp "${res.vitals?.bp}"`);
    if (c.noInvention) {
      const inv = [];
      if (Object.keys(res.vitals || {}).length) inv.push('vitals');
      if ((res.investigations || []).length && !(c.tests || []).length) inv.push('tests');
      if ((res.adviceBangla || []).length) inv.push('advice');
      if (res.followUp) inv.push('followUp');
      if (res.emergencyRedFlags) inv.push('redFlags');
      if (inv.length) row.notes.push(`INVENTED: ${inv.join(',')}`);
    }
  } else {
    row.notes.push(err);
  }
  rows.push(row);
  console.log(`${row.id.padEnd(7)} ${String(ms).padStart(5)}ms  med ${row.medOk}/${row.medTotal}  dose ${row.doseOk}/${row.doseTotal}  days ${row.daysOk}/${row.daysTotal}  ${row.notes.join(' | ')}`);
  await sleep(delay);
}

const sum = k => rows.reduce((a, r) => a + r[k], 0);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
const lat = rows.filter(r => !r.err).map(r => r.ms).sort((a, b) => a - b);
console.log('\n=== SUMMARY ===');
console.log(`cases: ${rows.length}  errors: ${rows.filter(r => r.err).length}`);
console.log(`medicine correct (exact or properly flagged): ${pct(sum('medOk'), sum('medTotal'))}  (${sum('medOk')}/${sum('medTotal')})`);
console.log(`dosage correct: ${pct(sum('doseOk'), sum('doseTotal'))}   duration correct: ${pct(sum('daysOk'), sum('daysTotal'))}`);
console.log(`cases with invented fields: ${rows.filter(r => r.notes.some(n => n.startsWith('INVENTED'))).length}`);
if (lat.length) console.log(`latency median ${lat[Math.floor(lat.length / 2)]}ms, max ${lat[lat.length - 1]}ms`);
fs.writeFileSync(new URL('./last-results.json', import.meta.url), JSON.stringify(rows, null, 2));
