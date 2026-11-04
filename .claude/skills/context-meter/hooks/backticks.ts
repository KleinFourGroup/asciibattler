// A backtick bash would run as a command substitution, and the refusal it earns.
//
// Bash runs the text between two backticks as a command and puts its output in
// their place, in a bare word, in double quotes and in an unquoted heredoc's
// body alike; in single quotes, `$' '` and a quoted heredoc's body a backtick is
// only a character. Text meant for a file, a markdown code span or a JS
// template literal sent through `node -e "…"` or `git commit -m "…"`, loses
// each span to a command's output (three phases running in Round 10,
// archive/worklog-phase-147.md, 147d). A backslash before a backtick keeps it
// a character, and a comment's text is not run.
//
// The Bash tool halves a run of backslashes before bash reads the command
// (halving.ts), which can leave bare a backtick written escaped: `\\\`` in
// double quotes reaches bash as `\\` and a bare backtick (144c's case). The
// backslash guard's model reads the two alike, so this one reads the command
// as written and, failing that, as bash gets it after the halving. Inside
// `$( )` within double quotes it does not see the inner quotes, so it errs
// toward refusing there.

import { halve } from './halving.ts';

const BS = '\\';

export type Found = { line: number; text: string; halved?: true };

/** The first backtick bash would run as a substitution, in the command as written or as halved. */
export function backtickBashRuns(cmd: string): Found | undefined {
  const written = substitutedBacktick(cmd);
  if (written !== undefined || !cmd.includes(BS)) return written;
  const got = substitutedBacktick(halve(cmd));
  return got === undefined ? undefined : { ...got, halved: true };
}

type Heredoc = { delim: string; quoted: boolean; strip: boolean };

/** The first line holding a backtick bash would run as a command substitution, or undefined. */
export function substitutedBacktick(cmd: string): Found | undefined {
  const n = cmd.length;
  const found = (at: number): Found => {
    const start = cmd.lastIndexOf('\n', at - 1) + 1;
    const end = cmd.indexOf('\n', at);
    return {
      line: (cmd.slice(0, at).match(/\n/g) ?? []).length + 1,
      text: cmd.slice(start, end < 0 ? n : end).trim(),
    };
  };
  let i = 0;
  let wordStart = true;
  let pending: Heredoc[] = [];

  while (i < n) {
    const c = cmd[i] as string;
    if (c === BS) {
      i += 2;
      wordStart = false;
    } else if (c === "'") {
      const j = cmd.indexOf("'", i + 1);
      i = j < 0 ? n : j + 1;
      wordStart = false;
    } else if (c === '$' && cmd[i + 1] === "'") {
      i += 2;
      while (i < n && cmd[i] !== "'") i += cmd[i] === BS ? 2 : 1;
      i++;
      wordStart = false;
    } else if (c === '"') {
      i++;
      while (i < n && cmd[i] !== '"') {
        if (cmd[i] === BS) i += 2;
        else if (cmd[i] === '`') return found(i);
        else i++;
      }
      i++;
      wordStart = false;
    } else if (c === '`') {
      return found(i);
    } else if (c === '#' && wordStart) {
      while (i < n && cmd[i] !== '\n') i++;
    } else if (c === '<' && cmd[i + 1] === '<' && cmd[i + 2] === '<') {
      i += 3;
      wordStart = true;
    } else if (c === '<' && cmd[i + 1] === '<') {
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
      i = j;
      wordStart = false;
    } else if (c === '\n') {
      i++;
      wordStart = true;
      for (const h of pending) {
        while (i < n) {
          const e = cmd.indexOf('\n', i);
          const end = e < 0 ? n : e;
          const text = cmd.slice(i, end);
          if ((h.strip ? text.replace(/^\t+/, '') : text) === h.delim) {
            i = end + 1;
            break;
          }
          if (!h.quoted) {
            for (let k = i; k < end; k++) {
              if (cmd[k] === BS) k++;
              else if (cmd[k] === '`') return found(k);
            }
          }
          i = end + 1;
        }
      }
      pending = [];
    } else {
      wordStart = /[\s;&|()]/.test(c);
      i++;
    }
  }
  return undefined;
}

const clip = (s: string): string => (s.length > 100 ? `${s.slice(0, 97)}...` : s);

/** The refusal's text: the line, why bash would run it, and what to send instead. */
export function backticksRefusal(f: Found): string {
  const where = f.halved ? ', as bash gets it after the Bash tool halves its backslashes' : '';
  return [
    `Backticks guard: refused before it ran. Line ${f.line}${where}: ${clip(f.text)}`,
    "Bash runs the text between two backticks as a command and puts its output in their place, in a bare word, in double quotes and in an unquoted heredoc, so a markdown code span or a JS template literal there is lost to a command's output.",
    "Send text that holds backticks through the Write or Edit tool, or in single quotes or a quoted heredoc (<<'EOF'); write a substitution you mean as $( ), and a backtick you mean in double quotes as \\`. (process/shell-and-windows.md, \"Bash calls\")",
  ].join('\n');
}
