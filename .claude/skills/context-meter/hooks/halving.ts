// The Bash tool's backslash halving, and the note a halved command earns.
//
// Measured on Claude Code 2.1.308 (archive/post-118-worklog.md §130, 130e): before bash reads a
// command, the Bash tool halves each run of backslashes, rounding up, unless a
// double quote follows the run, which keeps it whole; the transcript and the
// tool's input hold the command as written. Bash then applies its own rules,
// so a halved run can leave bash's reading unchanged (`"\\."` reads `\.`
// either way). The note goes out only when the reading changed, line by line,
// as the round's shell audit (`scratch/130/shell-audit.mjs`) cards a call;
// this file is that audit's model, ported.

const BS = '\\';

/** The Bash tool's layer: a run halves, rounding up, unless a double quote follows it. */
export const halve = (cmd: string): string =>
  cmd.replace(/\\+/g, (run: string, at: number, s: string) =>
    s[at + run.length] === '"' ? run : run.slice(0, Math.ceil(run.length / 2)),
  );

type Heredoc = { delim: string; quoted: boolean; strip: boolean };

/** Bash's reading of a command, as segments `ctx:text`, each context's backslash rule applied. */
export function lex(cmd: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = cmd.length;
  let word = '';
  let pending: Heredoc[] = [];
  const flush = (): void => {
    if (word !== '') out.push(`word:${word}`);
    word = '';
  };
  while (i < n) {
    const c = cmd[i];
    if (c === "'") {
      flush();
      const j = cmd.indexOf("'", i + 1);
      const end = j < 0 ? n : j;
      out.push(`sq:${cmd.slice(i + 1, end)}`);
      i = end + 1;
    } else if (c === '"') {
      flush();
      let s = '';
      i++;
      while (i < n && cmd[i] !== '"') {
        if (cmd[i] === BS && i + 1 < n && '$`"\\\n'.includes(cmd[i + 1] ?? '')) {
          if (cmd[i + 1] !== '\n') s += cmd[i + 1];
          i += 2;
        } else s += cmd[i++];
      }
      out.push(`dq:${s}`);
      i++;
    } else if (c === BS) {
      if (i + 1 < n && cmd[i + 1] !== '\n') word += cmd[i + 1];
      i += 2;
    } else if (c === '<' && cmd[i + 1] === '<' && cmd[i + 2] !== '<') {
      let j = i + 2;
      const strip = cmd[j] === '-';
      if (strip) j++;
      while (cmd[j] === ' ' || cmd[j] === '\t') j++;
      let delim = '';
      let quoted = false;
      while (j < n && !/[\s;|&<>()]/.test(cmd[j] ?? '')) {
        const q = cmd[j];
        if (q === "'" || q === '"') {
          quoted = true;
          const k = cmd.indexOf(q, j + 1);
          delim += cmd.slice(j + 1, k < 0 ? n : k);
          j = (k < 0 ? n : k) + 1;
        } else if (q === BS) {
          quoted = true;
          delim += cmd[j + 1] ?? '';
          j += 2;
        } else delim += cmd[j++];
      }
      pending.push({ delim, quoted, strip });
      word += `<<${delim}`;
      i = j;
    } else if (c === '\n' && pending.length > 0) {
      word += c;
      i++;
      flush();
      for (const h of pending) {
        const body: string[] = [];
        while (i < n) {
          const e = cmd.indexOf('\n', i);
          const lineEnd = e < 0 ? n : e;
          const line = cmd.slice(i, lineEnd);
          i = lineEnd + 1;
          if ((h.strip ? line.replace(/^\t+/, '') : line) === h.delim) break;
          body.push(line);
        }
        let text = body.join('\n');
        if (!h.quoted) text = text.replace(/\\([$`\\]|\n)/g, (_: string, x: string) => (x === '\n' ? '' : x));
        out.push(`${h.quoted ? 'heredoc-quoted' : 'heredoc'}:${text}`);
      }
      pending = [];
    } else {
      word += c;
      i++;
    }
  }
  flush();
  return out;
}

export type ChangedLine = { meant: string; got: string };

/** The lines of bash's reading that the halving changed, each with its reading as written. */
export function changedLines(cmd: string): ChangedLine[] {
  if (!cmd.includes(BS + BS)) return [];
  const meant = lex(cmd);
  const got = lex(halve(cmd));
  const text = (seg: string | undefined): string => (seg ?? '').slice((seg ?? '').indexOf(':') + 1);
  const pairs: ChangedLine[] = [];
  for (let s = 0; s < Math.max(meant.length, got.length); s++) {
    if (meant[s] === got[s]) continue;
    const a = text(meant[s]).split('\n');
    const b = text(got[s]).split('\n');
    for (let k = 0; k < Math.max(a.length, b.length); k++) {
      if (a[k] !== b[k]) pairs.push({ meant: a[k] ?? '', got: b[k] ?? '' });
    }
  }
  return pairs;
}

const MEASURED_ON = '2.1.308';
const clip = (s: string): string => (s.length > 160 ? `${s.slice(0, 157)}...` : s);

/** The note for a command whose reading the halving changed, or undefined. */
export function halvingNote(cmd: string, version: string): string | undefined {
  const pairs = changedLines(cmd);
  if (pairs.length === 0) return undefined;
  const shown = pairs
    .slice(0, 3)
    .flatMap((p) => [`  as written: ${clip(p.meant.trimStart())}`, `  bash got:   ${clip(p.got.trimStart())}`]);
  const more = pairs.length > 3 ? [`  (and ${pairs.length - 3} more changed lines)`] : [];
  return [
    `Backslash note: the Bash tool halves a run of backslashes that no double quote follows (measured on Claude Code ${MEASURED_ON}; this session runs ${version}), so bash read ${pairs.length === 1 ? 'a line' : `${pairs.length} lines`} of this command differently from how it was written:`,
    ...shown,
    ...more,
    'A file written with the Write tool, or the PowerShell tool, passes backslashes whole.',
  ].join('\n');
}
