// The stdin guard's model (.claude/skills/context-meter/hooks/stdin.ts) held
// to the shapes that hung on Claude Code 2.1.309 (archive/worklog-phase-137.md,
// "The stdin hangs, traced"), each taken from a transcript, and to the shapes
// that read stdin with something feeding it, which it must let through.
import { describe, expect, it } from 'vitest';
import { stdinRefusal, stdinStall } from '../.claude/skills/context-meter/hooks/stdin.ts';

describe('the stdin guard refuses a step that reads stdin with nothing to feed it', () => {
  it.each([
    ['a stray cat line above a heredoc', `cat > "$X/dev/null" 2>/dev/null; MSG=/tmp/m.txt; cat > "$MSG" <<'EOF'\nbody\nEOF\ngit commit -F "$MSG"`, 'cat', 1],
    ['a stray cat line with || true', `cat > "$TMPDIR/msg.txt" 2>/dev/null || true; M=/tmp/m; printf '%s\\n' "a" > "$M"`, 'cat', 1],
    ['a cat under timeout', `timeout 5 cat > "$S/probe.txt" 2>/dev/null; echo done`, 'cat', 1],
    ['a cat after a cd line', `cd /c/repo\ncat > /tmp/nul 2>/dev/null; npx tsx -e "1"`, 'cat', 2],
    ['python with no script', `python3 - 2>/dev/null || node -e "\nconst a = 1;\n"`, 'python', 1],
    ['python with an empty heredoc', `python3 - <<'EOF' 2>&1 || echo "no python"\nEOF\ngrep -n x WORKLOG.md`, 'python', 1],
    ['python with an empty heredoc after a quoted fallback', `python - 2>/dev/null <<'EOF' || node -e "\nconst f = 1;\n"\nEOF`, 'python', 1],
    ['python on the third line', `cat > /dev/null <<'EOF'\nEOF\npython - <<'PY' 2>/dev/null || echo "no python"\nPY`, 'python', 3],
  ])('%s', (_, cmd, kind, line) => {
    expect(stdinStall(cmd)).toMatchObject({ kind, line });
  });

  it('names the line and what to send instead', () => {
    const text = stdinRefusal(stdinStall(`cat > "$TMP/x" 2>/dev/null; echo`)!);
    expect(text).toContain('Line 1: cat > "$TMP/x" 2>/dev/null');
    expect(text).toContain(': > file');
    expect(text).toContain('process/shell-and-windows.md');
  });
});

describe('the stdin guard lets through a step that has something feeding it', () => {
  it.each([
    ['a heredoc with a body', `cat > f.txt <<'EOF'\nline\nEOF`],
    ['the heredoc before the redirect', `cat <<EOF > f.txt\nline\nEOF`],
    ['a tab-stripped heredoc', `cat > f.txt <<-EOF\n\tline\n\tEOF`],
    ['an empty heredoc into cat, which makes an empty file and returns', `cat > f.txt <<'EOF'\nEOF\necho ok`],
    ['a file operand', `cat a.txt > out.txt`],
    ['process substitution', `cat <(git show HEAD:a.txt) > out.txt`],
    ['an input redirect', `cat > out.txt < in.txt`],
    ['a here-string', `cat > out.txt <<< "text"`],
    ['the end of a pipe', `echo x | cat > f.txt`],
    ['a pipe continued on the next line', `git log --oneline |\n  cat > log.txt`],
    ['a cat inside a quoted script', `node -e '\nconst s = 1;\ncat > x\n'`],
    ['a cat inside a commit message', `git commit -m "fix; cat > file"`],
    ['a cat inside a heredoc body', `cat > run.sh <<'EOF'\ncat > out.txt\nEOF`],
    ['a cat inside a loop fed by the loop', `while read l; do cat > "$l"; done < list.txt`],
    ['a cat in a comment', `# cat > f.txt\necho hi`],
    ['python with a heredoc body', `python3 - <<'EOF' 2>&1\nprint("ran")\nEOF`],
    ['python with -c', `python3 -c "print(1)"`],
    ['python with a script file', `python3 scripts/x.py --flag`],
    ['python asked for its version', `python3 --version 2>&1; node --version`],
    ['python fed by a pipe', `echo 'print(1)' | python3 -`],
    ['no stdin reader at all', `git status --short && npm test 2>&1 | tail -5`],
  ])('%s', (_, cmd) => {
    expect(stdinStall(cmd)).toBeUndefined();
  });
});
