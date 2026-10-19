// Usage: node read-s6.mjs <transcript.jsonl> <untilISO> <word> [reading...]
// Prints assistant text blocks before untilISO that contain <word>, then, for
// each reading, whether some response's total input (input + cache read +
// cache write) equals it. Self-check: a planted reading of 123,457 must miss.
import { readFileSync } from 'node:fs';

const [file, until, word, ...readings] = process.argv.slice(2);
const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
const totals = new Map();
for (const l of lines) {
  let o;
  try { o = JSON.parse(l); } catch { continue; }
  const m = o.message;
  if (o.type !== 'assistant' || !m) continue;
  const u = m.usage;
  if (u) {
    const t = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    if (!totals.has(t)) totals.set(t, o.timestamp);
  }
  if (o.timestamp < until && Array.isArray(m.content)) {
    for (const c of m.content) {
      if (c.type === 'text' && c.text.includes(word)) {
        console.log(`--- ${o.timestamp}\n${c.text}\n`);
      }
    }
  }
}
for (const r of [...readings, '123457']) {
  const n = Number(r.replace(/,/g, ''));
  console.log(`${r}: ${totals.has(n) ? 'match at ' + totals.get(n) : 'NO MATCH'}${r === '123457' ? ' (planted, must miss)' : ''}`);
}
