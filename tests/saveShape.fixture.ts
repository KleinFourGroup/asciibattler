// The known answer for tests/saveShape.ts: a small snapshot type that has one
// of everything the walker prints. tests/save-fingerprint.test.ts expands
// `FixtureSnapshot` and compares the print with the text written out there by
// hand, then expands `FixtureSnapshotChanged`, which differs in one nested
// optional field.

type Phase = 'map' | 'battle' | 'defeat';

interface Mod {
  mul?: number;
  add?: number;
}

interface Effect {
  key: string;
  mods: { power?: Mod; speed?: Mod };
  lifetime: { kind: 'ticks'; expiresAtTick: number } | { kind: 'endOfTurn' };
}

interface Unit {
  readonly archetype: string;
  level: number;
  effects?: Effect[];
}

/** A type that contains itself. */
interface Cursor {
  index: number;
  child: Cursor | null;
}

export interface FixtureSnapshot {
  schemaVersion: 7;
  phase: Phase;
  team: Unit[];
  offer: Unit[] | null;
  pair: [number, string];
  flags: Record<string, boolean | number>;
  cursor: Cursor | null;
  seen: Set<number>;
  ready: boolean;
}

interface ModChanged {
  mul?: number;
  add?: number;
  cap?: number;
}

interface EffectChanged {
  key: string;
  mods: { power?: ModChanged; speed?: ModChanged };
  lifetime: { kind: 'ticks'; expiresAtTick: number } | { kind: 'endOfTurn' };
}

interface UnitChanged {
  readonly archetype: string;
  level: number;
  effects?: EffectChanged[];
}

/** `FixtureSnapshot` with one optional field added three levels down (`Mod.cap`). */
export interface FixtureSnapshotChanged {
  schemaVersion: 7;
  phase: Phase;
  team: UnitChanged[];
  offer: UnitChanged[] | null;
  pair: [number, string];
  flags: Record<string, boolean | number>;
  cursor: Cursor | null;
  seen: Set<number>;
  ready: boolean;
}
