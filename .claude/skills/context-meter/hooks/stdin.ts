// A step that reads stdin with nothing to feed it, and the refusal it earns.
//
// Measured on Claude Code 2.1.309 (archive/worklog-phase-137.md, "The stdin
// hangs, traced"): the Bash tool runs most commands with stdin on /dev/null,
// where a stray `cat > file` writes an empty file and moves on, but it hands a
// command holding a heredoc (and some others) to the shell through a pipe it
// never closes. There a step that reads stdin swallows the rest of the script
// and waits for good: `timeout` does not end it, and the tool's own limit only
// moves it to the background. `python3` here, the Python Install Manager's
// alias, waits on an empty script wherever its stdin points. Each one seen was
// a stray first line left above the command meant.
//
// The model reads bash's top level only. A step inside a quoted string, a
// heredoc's body, `$( )`, a loop, a group or an `if` is not looked at, so the
// guard errs toward letting a command run.

const BS = '\\';

export type Stall = { kind: 'cat' | 'python'; line: number; text: string };

type Heredoc = { delim: string; strip: boolean; empty: boolean };

type Cmd = {
  words: string[];
  depth: number;
  line: number;
  start: number;
  end: number;
  stdin: 'none' | 'pipe' | 'file' | 'heredoc' | 'herestring';
  heredoc: Heredoc | undefined;
};

// Reserved words at a command's start: those that open or close a compound,
// and those that only lead the command after them.
const OPENS = new Set(['if', 'case', 'do', '{']);
const CLOSES = new Set(['fi', 'esac', 'done', '}']);
const LEADS = new Set(['then', 'else', 'elif', '!', 'time', 'while', 'until']);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;
const PYTHON = /^(python(3(\.\d+)?)?|py)$/;

const base = (word: string): string => (word.split(/[\\/]/).pop() ?? '').toLowerCase().replace(/\.exe$/, '');

/** The words a wrapper (`timeout 5`, `nohup`, `env X=1`) puts before the command it runs. */
function unwrap(words: string[]): string[] {
  let w = words;
  for (;;) {
    const name = base(w[0] ?? '');
    if (name === 'nohup' || name === 'command' || name === 'exec' || name === 'builtin') {
      w = w.slice(1);
    } else if (name === 'timeout') {
      let k = 1;
      while ((w[k] ?? '').startsWith('-')) k += w[k] === '-k' || w[k] === '-s' ? 2 : 1;
      w = w.slice(k + 1);
    } else if (name === 'env') {
      let k = 1;
      while ((w[k] ?? '').startsWith('-') || ASSIGNMENT.test(w[k] ?? '')) k++;
      w = w.slice(k);
    } else if (name === 'nice') {
      w = w.slice(w[1] === '-n' ? 3 : /^-\d+$/.test(w[1] ?? '') ? 2 : 1);
    } else return w;
  }
}

/** The first top-level step of a command that reads stdin with nothing to feed it, or undefined. */
export function stdinStall(cmd: string): Stall | undefined {
  const cmds: Cmd[] = [];
  const n = cmd.length;
  let i = 0;
  let line = 1;
  let depth = 0;
  let paren = 0;
  const fresh = (stdin: Cmd['stdin']): Cmd => ({ words: [], depth: 0, line, start: i, end: i, stdin, heredoc: undefined });
  let cur = fresh('none');
  let pending: Heredoc[] = [];

  const close = (stdin: Cmd['stdin']): void => {
    if (cur.words.length > 0) cmds.push(cur);
    if (cur.words.length > 0 || stdin === 'pipe') cur = fresh(stdin);
  };

  // From an opening bracket at i to just past its match, quotes inside skipped.
  const skipBalanced = (open: string, shut: string): void => {
    let d = 0;
    while (i < n) {
      const ch = cmd[i];
      if (ch === '\n') line++;
      if (ch === "'" || ch === '"') {
        const j = cmd.indexOf(ch, i + 1);
        line += (cmd.slice(i, j < 0 ? n : j).match(/\n/g) ?? []).length;
        i = j < 0 ? n : j + 1;
        continue;
      }
      if (ch === open) d++;
      else if (ch === shut && --d === 0) {
        i++;
        return;
      }
      i++;
    }
  };

  // A word from i: quotes, escapes, `$( )`, `${ }` and backticks kept whole.
  const readWord = (): { raw: string; value: string } => {
    const from = i;
    let value = '';
    while (i < n) {
      const c = cmd[i] as string;
      if (/[\s;&|<>()]/.test(c)) break;
      if (c === BS) {
        if (cmd[i + 1] === '\n') line++;
        else value += cmd[i + 1] ?? '';
        i += 2;
      } else if (c === "'") {
        const j = cmd.indexOf("'", i + 1);
        const end = j < 0 ? n : j;
        value += cmd.slice(i + 1, end);
        line += (cmd.slice(i, end).match(/\n/g) ?? []).length;
        i = end + 1;
      } else if (c === '"') {
        i++;
        while (i < n && cmd[i] !== '"') {
          if (cmd[i] === '\n') line++;
          if (cmd[i] === BS && i + 1 < n) {
            value += cmd[i + 1];
            i += 2;
          } else value += cmd[i++];
        }
        i++;
      } else if (c === '$' && (cmd[i + 1] === '(' || cmd[i + 1] === '{')) {
        const at = i;
        i++;
        if (cmd[i] === '(') skipBalanced('(', ')');
        else skipBalanced('{', '}');
        value += cmd.slice(at, i);
      } else if (c === '`') {
        const at = i;
        i++;
        while (i < n && cmd[i] !== '`') {
          if (cmd[i] === '\n') line++;
          i += cmd[i] === BS ? 2 : 1;
        }
        i++;
        value += cmd.slice(at, i);
      } else {
        value += c;
        i++;
      }
    }
    return { raw: cmd.slice(from, i), value };
  };

  const addWord = (raw: string, value: string, at: number, atLine: number): void => {
    if (cur.words.length === 0 && raw === value) {
      if (OPENS.has(raw)) return void depth++;
      if (CLOSES.has(raw)) return void (depth = Math.max(0, depth - 1));
      if (LEADS.has(raw) || ASSIGNMENT.test(raw)) return;
    }
    if (cur.words.length === 0) {
      cur.depth = depth + paren;
      cur.line = atLine;
      cur.start = at;
    }
    cur.words.push(value);
    cur.end = i;
  };

  const skipBlanks = (): void => {
    while (cmd[i] === ' ' || cmd[i] === '\t') i++;
  };

  while (i < n) {
    const c = cmd[i] as string;
    if (c === ' ' || c === '\t') {
      i++;
    } else if (c === '#') {
      while (i < n && cmd[i] !== '\n') i++;
    } else if (c === '\n') {
      i++;
      line++;
      if (cur.words.length > 0) close('none');
      for (const doc of pending) {
        let lines = 0;
        while (i < n) {
          const e = cmd.indexOf('\n', i);
          const end = e < 0 ? n : e;
          const text = cmd.slice(i, end);
          i = end + 1;
          line++;
          if ((doc.strip ? text.replace(/^\t+/, '') : text) === doc.delim) break;
          lines++;
        }
        doc.empty = lines === 0;
      }
      pending = [];
    } else if (c === ';' || c === '&') {
      if (c === '&' && cmd[i + 1] === '>') {
        i += cmd[i + 2] === '>' ? 3 : 2;
        skipBlanks();
        readWord();
        cur.end = i;
      } else {
        i += cmd[i + 1] === c ? 2 : 1;
        close('none');
      }
    } else if (c === '|') {
      const or = cmd[i + 1] === '|';
      i += or || cmd[i + 1] === '&' ? 2 : 1;
      close(or ? 'none' : 'pipe');
    } else if (c === '(') {
      i++;
      if (cur.words.length === 0) paren++;
    } else if (c === ')') {
      i++;
      if (paren > 0) {
        close('none');
        paren--;
      }
    } else if (c === '<' || c === '>') {
      // A redirect with no number before it; `2>`, `0<` are read below.
      redirect(undefined);
    } else {
      const at = i;
      const atLine = line;
      const { raw, value } = readWord();
      if (/^\d+$/.test(raw) && (cmd[i] === '<' || cmd[i] === '>')) redirect(raw);
      else addWord(raw, value, at, atLine);
    }
  }
  close('none');

  function redirect(fd: string | undefined): void {
    const stdin = fd === undefined || fd === '0';
    const op = cmd.slice(i, i + 3);
    if ((op.startsWith('<(') || op.startsWith('>(')) && fd === undefined) {
      // Process substitution: a file name the command reads or writes.
      const at = i;
      const atLine = line;
      i++;
      skipBalanced('(', ')');
      addWord('<(', cmd.slice(at, i), at, atLine);
      return;
    }
    if (op === '<<<') {
      i += 3;
      if (stdin) cur.stdin = 'herestring';
    } else if (op.startsWith('<<')) {
      i += 2;
      const strip = cmd[i] === '-';
      if (strip) i++;
      skipBlanks();
      const { value } = readWord();
      const doc: Heredoc = { delim: value, strip, empty: true };
      pending.push(doc);
      if (stdin) {
        cur.stdin = 'heredoc';
        cur.heredoc = doc;
      }
      cur.end = i;
      return;
    } else if (op.startsWith('<')) {
      i += op[1] === '>' || op[1] === '&' ? 2 : 1;
      if (stdin) cur.stdin = 'file';
    } else {
      i += op[1] === '>' || op[1] === '|' || op[1] === '&' ? 2 : 1;
    }
    skipBlanks();
    readWord();
    cur.end = i;
  }

  for (const c of cmds) {
    if (c.depth > 0) continue;
    const w = unwrap(c.words);
    const name = base(w[0] ?? '');
    const args = w.slice(1);
    const text = (cmd.slice(c.start, c.end).split('\n')[0] ?? '').trim();
    if (name === 'cat') {
      const files = args.filter((a) => a === '-' || !a.startsWith('-'));
      if ((files.length === 0 || files.includes('-')) && c.stdin === 'none') return { kind: 'cat', line: c.line, text };
    } else if (PYTHON.test(name)) {
      // Only a bare interpreter or `-` as the script reads one from stdin;
      // `-c`, `-m`, a file, or options alone (`--version`) do not.
      if (args.some((a) => /^-[^-]*[cm]/.test(a))) continue;
      const script = args.find((a) => a === '-' || !a.startsWith('-'));
      const fromStdin = args.length === 0 || script === '-';
      const fed = c.stdin === 'pipe' || c.stdin === 'file' || c.stdin === 'herestring' || (c.stdin === 'heredoc' && c.heredoc?.empty === false);
      if (fromStdin && !fed) return { kind: 'python', line: c.line, text };
    }
  }
  return undefined;
}

const clip = (s: string): string => (s.length > 100 ? `${s.slice(0, 97)}...` : s);

/** The refusal's text: what was found, why it would wait, and what to send instead. */
export function stdinRefusal(s: Stall): string {
  const why =
    s.kind === 'cat'
      ? 'This `cat` reads stdin and nothing feeds it.'
      : 'This Python reads its script from stdin and nothing feeds it one, or an empty heredoc does; python3 here waits on an empty script.';
  const instead =
    s.kind === 'cat'
      ? 'If the line is a leftover, drop it and send the command again; to make an empty file, use `: > file`.'
      : 'If the line is a leftover, drop it and send the command again; otherwise give Python a script: a heredoc with a body, -c, or a file.';
  return [
    `stdin guard: refused before it ran. Line ${s.line}: ${clip(s.text)}`,
    `${why} The Bash tool hands a command holding a heredoc (and some others) to the shell through a pipe it never closes, so a step that reads stdin there waits for good, past \`timeout\` and in the background too.`,
    `${instead} (process/shell-and-windows.md, "Bash calls")`,
  ].join('\n');
}
