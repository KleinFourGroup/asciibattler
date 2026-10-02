import type { EngineInterface, Register } from 'claude-code'

const GIT_COMMIT = /\bgit\s+commit\b/

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

  on('tool.call', { tool: 'Bash' }, ($, e, next) =>
    withReading($, e.command, next(e)),
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

  const line = await reading($)
  $.ui.log(line)

  return { ...ran, context: [...(ran.context ?? []), line] }
}
