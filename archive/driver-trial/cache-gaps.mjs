// The cache cost of idle gaps, from Claude Code session transcripts.
//
//   node cache-gaps.mjs [--until=<ISO time>] <transcript.jsonl>...
//   node cache-gaps.mjs --self-check
//
// Transcripts are ~/.claude/projects/<the repo's slug>/
// <session uuid>.jsonl. For each one: per API response (deduped by message
// id), the cache write and read; every response after a gap of over 4
// minutes, marked COLD when it wrote more than it read (the cache had
// expired); and the totals. A wake's cost is the write on its first
// response. Written 2026-10-16, session e4e49bf0; findings.md has its first
// readings.
//
// Since 2026-10-17 (session d68f6ca6) it also totals output tokens and prices
// every response at its model's API list price, so reads, writes and output
// add up in one unit. How a plan's usage limits count them is not known.
// PRICES is from the claude-api skill's model table and prompt-caching notes
// (cached 2026-10-06). A model missing from PRICES is named and left
// unpriced, never priced at a default. A write with no TTL split recorded is
// priced as 1h, the tier these sessions write. --until drops responses after
// that time, to reproduce a total quoted then. --self-check runs a planted
// transcript with a known answer, and fails loudly if any total is off.
import fs from "node:fs";

// $ per million tokens.
const PRICES = {
  "claude-opus-5-5": { input: 4, write5m: 5, write1h: 8, read: 0.2, output: 20 },
};

function parse(text, until) {
  const seen = new Set();
  const rows = [];
  const tiers = new Set();
  let splitMismatch = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    const m = j.message;
    if (!m || !m.usage || !m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    const t = new Date(j.timestamp);
    if (until && t > until) continue;
    const u = m.usage;
    const cc = u.cache_creation;
    if (cc) for (const k of Object.keys(cc)) if (cc[k]) tiers.add(k);
    const write = u.cache_creation_input_tokens ?? 0;
    const w5m = cc ? (cc.ephemeral_5m_input_tokens ?? 0) : 0;
    const w1h = cc ? (cc.ephemeral_1h_input_tokens ?? 0) : write;
    if (w5m + w1h !== write) splitMismatch++;
    rows.push({
      t,
      model: m.model,
      write, w5m, w1h,
      read: u.cache_read_input_tokens ?? 0,
      inp: u.input_tokens ?? 0,
      out: u.output_tokens ?? 0,
    });
  }
  rows.sort((a, b) => a.t - b.t);
  return { rows, tiers, splitMismatch };
}

function tally(rows) {
  const T = {
    write: 0, read: 0, inp: 0, out: 0, cold: 0, coldW: 0, gaps: [],
    usd: { read: 0, write: 0, out: 0, inp: 0, total: 0 }, unpriced: new Map(),
  };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    T.write += r.write; T.read += r.read; T.inp += r.inp; T.out += r.out;
    const p = PRICES[r.model];
    if (p) {
      const read = (r.read * p.read) / 1e6;
      const write = (r.w5m * p.write5m + r.w1h * p.write1h) / 1e6;
      const out = (r.out * p.output) / 1e6;
      const inp = (r.inp * p.input) / 1e6;
      T.usd.read += read; T.usd.write += write; T.usd.out += out; T.usd.inp += inp;
      T.usd.total += read + write + out + inp;
    } else {
      T.unpriced.set(r.model, (T.unpriced.get(r.model) ?? 0) + 1);
    }
    const gap = i ? (r.t - rows[i - 1].t) / 60000 : 0;
    if (gap > 4) {
      const isCold = r.write > r.read;
      if (isCold) { T.cold++; T.coldW += r.write; }
      T.gaps.push({ gap, r, isCold });
    }
  }
  return T;
}

const $ = x => `$${x.toFixed(2)}`;

function report(name, text, until) {
  const { rows, tiers, splitMismatch } = parse(text, until);
  const T = tally(rows);
  console.log(`\n== ${name}: ${rows.length} responses, ${rows[0]?.t.toISOString()} -> ${rows.at(-1)?.t.toISOString()}${until ? ` (until ${until.toISOString()})` : ""}`);
  console.log(`   cache tiers written: ${[...tiers].join(", ") || "(no split recorded)"}`);
  for (const { gap, r, isCold } of T.gaps) {
    console.log(`   gap ${gap.toFixed(1).padStart(6)} min -> ${r.t.toISOString().slice(11, 19)}  write ${String(r.write).padStart(7)}  read ${String(r.read).padStart(7)}${isCold ? "  COLD" : ""}`);
  }
  console.log(`   totals: write ${T.write}, read ${T.read}, uncached input ${T.inp}; cold wakes ${T.cold}, writing ${T.coldW}`);
  console.log(`   output ${T.out}; at list price ${$(T.usd.total)}: reads ${$(T.usd.read)}, writes ${$(T.usd.write)}, output ${$(T.usd.out)}, uncached input ${$(T.usd.inp)}`);
  if (T.unpriced.size) console.log(`   UNPRICED (not in the total): ${[...T.unpriced].map(([m, n]) => `${m} x${n}`).join(", ")}`);
  if (splitMismatch) console.log(`   WARNING: ${splitMismatch} responses whose 5m + 1h split doesn't sum to their write`);
  return T;
}

function selfCheck() {
  const t0 = Date.parse("2026-01-01T00:00:00Z");
  const line = (id, min, model, u) => JSON.stringify({
    timestamp: new Date(t0 + min * 60000).toISOString(),
    message: { id, model, usage: u },
  });
  const w1h = (n, read, out, inp = 0) => ({
    input_tokens: inp, cache_creation_input_tokens: n, cache_read_input_tokens: read, output_tokens: out,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: n },
  });
  const text = [
    line("A", 0, "claude-opus-5-5", w1h(1000, 0, 100, 10)),
    line("A", 0, "claude-opus-5-5", w1h(1000, 0, 100, 10)), // a second line of the same response
    line("B", 2, "claude-opus-5-5", w1h(50, 1000, 20)),
    line("C", 70, "claude-opus-5-5", w1h(1100, 0, 30)), // cold after 68 min
    line("D", 75, "claude-planted-9", w1h(10, 1100, 5)), // unknown model: unpriced
    line("E", 200, "claude-opus-5-5", w1h(5000, 0, 999)), // after --until
  ].join("\n");
  const { rows } = parse(text, new Date(t0 + 100 * 60000));
  const T = tally(rows);
  // $: input 10*4 + writes (1000+50+1100)*8 + reads 1000*0.2 + output 150*20 = 20440 per 1e6
  const want = {
    responses: 4, write: 2160, read: 2100, out: 155, cold: 1, coldW: 1100,
    usd: 0.02044, unpriced: "claude-planted-9 x1",
  };
  const got = {
    responses: rows.length, write: T.write, read: T.read, out: T.out, cold: T.cold, coldW: T.coldW,
    usd: Math.round(T.usd.total * 1e8) / 1e8, unpriced: [...T.unpriced].map(([m, n]) => `${m} x${n}`).join(", "),
  };
  const bad = Object.keys(want).filter(k => want[k] !== got[k]);
  if (bad.length) {
    console.error("SELF-CHECK FAILED:", bad.map(k => `${k} want ${want[k]} got ${got[k]}`).join("; "));
    process.exit(1);
  }
  console.log("self-check ok:", JSON.stringify(got));
}

const args = process.argv.slice(2);
if (args.includes("--self-check")) {
  selfCheck();
} else {
  const untilArg = args.find(a => a.startsWith("--until="));
  const until = untilArg ? new Date(untilArg.slice(8)) : undefined;
  if (until && Number.isNaN(until.getTime())) throw new Error(`bad --until: ${untilArg}`);
  for (const file of args.filter(a => !a.startsWith("--"))) {
    report(file.split(/[\\/]/).pop().slice(0, 8), fs.readFileSync(file, "utf8"), until);
  }
}
