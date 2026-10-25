import type { EngineInterface, Register } from 'claude-code'
import { halvingNote } from './halving.ts'
import { HAND_OFF_AT, commitIn, landed, pastTrigger } from './handoff.ts'

// The reading is the input tokens the last response was answered over, so it
// trails the live window by that response's output and any tool results since.
async function reading($: EngineInterface): Promise<string> {
  const { context } = await $.session.usage()
  const at = new Date(await $.clock.now()).toISOString()

  return context.tokens === undefined
    ? `context: no reading at ${at}; the live window has had no response yet (window ${context.window})`
    : `context: ${context.tokens} tokens of ${context.window} (${context.percent ?? '?'}%) at ${at}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'read',
      description:
        "Reads this session's context fill: the input tokens the last response was answered over, the model's window, and the percentage, as the status line has them. Takes no input.",
    })

    return next(e)
  })

  on('tool.call', { tool: 'mcp__context-meter__read' }, async $ => ({
    result: await reading($),
  }))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) =>
    withHalvingNote($, e.command, await withHandOff($, e.command, () => next(e))),
  )
  on('tool.call', { tool: 'PowerShell' }, ($, e, next) =>
    withHandOff($, e.command, () => next(e)),
  )
}

// A commit is a step's boundary, where the trigger is read (handoff.ts): past
// it, a commit that landed carries the hand-off line, which the model reads as
// context and the person sees as a transcript line. Below it, nothing.
async function withHandOff<R extends { deny?: string; context?: readonly string[] }>(
  $: EngineInterface,
  command: string,
  run: () => Promise<R>,
): Promise<R> {
  const commit = commitIn(command)
  if (commit === undefined || !pastTrigger((await $.session.usage()).context.tokens)) {
    return run()
  }

  const before = await head($, commit.dir)
  const ran = await run()
  if (ran.deny !== undefined || !landed(before, await head($, commit.dir))) {
    return ran
  }

  const line = `${await reading($)}; past the hand-off trigger (${HAND_OFF_AT / 1000}k): hand off after this commit`
  $.ui.log(line)

  return { ...ran, context: [...(ran.context ?? []), line] }
}

// HEAD's hash in the commit's folder (the session's, or the one `-C` names),
// or undefined where git can't say.
async function head($: EngineInterface, dir: string | undefined): Promise<string | undefined> {
  const argv = dir === undefined ? ['git', 'rev-parse', 'HEAD'] : ['git', '-C', dir, 'rev-parse', 'HEAD']
  try {
    const { exitCode, stdout } = await $.process.run(argv)
    return exitCode === 0 ? stdout.trim() : undefined
  } catch {
    return undefined
  }
}

// The command ran as the Bash tool halved it; when bash read it differently
// from how it was written, the result says so (halving.ts has the model).
// A note, never a refusal: a harness fix would make the model wrong, and a
// wrong note costs less than a refused correct command.
async function withHalvingNote<R extends { deny?: string; context?: readonly string[] }>(
  $: EngineInterface,
  command: string,
  ran: R,
): Promise<R> {
  if (ran.deny !== undefined) {
    return ran
  }

  const note = halvingNote(command, (await $.session.version()).version)
  if (note === undefined) {
    return ran
  }

  $.ui.log('backslash note: bash read this command differently from how it was written')
  return { ...ran, context: [...(ran.context ?? []), note] }
}
