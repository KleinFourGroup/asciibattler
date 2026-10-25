/** A friction-log entry, as one line of retro/papercuts.jsonl holds it. */
export interface PapercutEntry {
  readonly ts: string;
  readonly who: string;
  readonly kind: 'papercut' | 'distress';
  readonly session?: string;
  readonly phase?: string;
  readonly text: string;
}

export function entryFrom(input: {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  /** The text a --file or --stdin supplied. */
  readonly text?: string;
  readonly now: Date;
}):
  | { readonly entry: PapercutEntry; readonly warnings: readonly string[]; readonly error?: undefined }
  | { readonly error: string; readonly entry?: undefined; readonly warnings?: undefined };
