import type { EngineInterface, Register } from 'claude-code'
import { halvingNote } from './halving.ts'

const GIT_COMMIT = /\bgit\s+commit\b/

// The hand-off trigger (process/planning.md, "Context: the hand-off
// trigger"): a commit past it is where the session hands off.
const HAND_OFF_AT = 500_000

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
    withHalvingNote($, e.command, await withReading($, e.command, next(e))),
  )
  on('tool.call', { tool: 'PowerShell' }, ($, e, next) =>
    withReading($, e.command, next(e)),
  )
}

// A commit is a step's boundary, so its result carries a reading: the model
// reads it as context, and the person sees it as a transcript line.
async function withReading<R extends { deny?: string; context?: readonly string[] }>(
  $: EngineInterface,
  command: string,
  running: Promise<R>,
): Promise<R> {
  const ran = await running
  if (ran.deny !== undefined || !GIT_COMMIT.test(command)) {
    return ran
  }

  const { context } = await $.session.usage()
  const past = context.tokens !== undefined && context.tokens > HAND_OFF_AT
  const line = past
    ? `${await reading($)}; past the hand-off trigger (${HAND_OFF_AT / 1000}k): hand off after this commit`
    : await reading($)
  $.ui.log(line)

  return { ...ran, context: [...(ran.context ?? []), line] }
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
