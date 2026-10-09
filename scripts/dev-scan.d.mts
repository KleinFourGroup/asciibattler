/** A dev module (a file or a folder) and the strings its code carries into a build. */
export interface DevMarkerRow {
  readonly source: string;
  readonly markers: readonly string[];
  /** The diagnostics panel's: passed in a build made with it. */
  readonly diag?: true;
}

export const DEV_MARKERS: readonly DevMarkerRow[];

export interface DevLeak {
  /** The build's file, relative to the scanned folder. */
  readonly file: string;
  readonly marker: string;
  readonly source: string;
}

export function devLeaks(dir: string, opts?: { diag?: boolean }): DevLeak[];
