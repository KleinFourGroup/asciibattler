/**
 * J3 — the unified, rebindable keybinding defaults.
 *
 * One place every in-game hotkey's DEFAULT lives, validated at boot. The
 * runtime registry (`src/ui/Keybindings.ts`) seeds itself from these and lets a
 * future in-game rebind screen override them via `rebind` — so the JSON is the
 * shipped default, not a hard ceiling. I3's fast-forward `hotkey` field
 * relocated here (the `playback.ts` §J3 note finally cashed in), so the two
 * hotkey-config sites collapse to one.
 *
 * Values are `KeyboardEvent.code`s (layout-independent — `KeyF` is the physical
 * F key on any layout), so the binding survives a Dvorak/AZERTY user the way a
 * `key` (`"f"`) would not.
 *
 * Adding an action: add it to `KEYBIND_ACTIONS` + the schema + the JSON. The
 * schema requires every action be present, so a missing default fails fast at
 * boot rather than silently leaving an action unbound.
 *
 * Q1 — I3's single `fastForward` cycle hotkey was replaced by **per-speed set
 * keys** (`speedHalf` / `speed1` / `speed2` / `speed3`) + a `togglePause`
 * (default `Space`). The pause key doubles as the Q2 countdown's "Fight now"
 * (the countdown is a pause with an auto-unpause timer — one "is the sim
 * advancing?" state). A digit bound to a step the difficulty system disabled
 * just no-ops at `PlaybackSpeed.setSpeed`.
 *
 * Source of truth at `config/keybindings.json`.
 */

import { z } from 'zod';
import keybindingsJson from '../../config/keybindings.json';

/** The rebindable in-game actions. Order is for readability only — the
 *  registry keys off the action name, not position. */
export const KEYBIND_ACTIONS = [
  'speedHalf',
  'speed1',
  'speed2',
  'speed3',
  'togglePause',
  'setObjective',
  'clearObjective',
] as const;
export type KeybindAction = (typeof KEYBIND_ACTIONS)[number];

const KeybindingsSchema = z.object({
  /** Set sim speed to 0.5× (Q1). */
  speedHalf: z.string().min(1),
  /** Set sim speed to 1× (Q1). */
  speed1: z.string().min(1),
  /** Set sim speed to 2× (Q1). */
  speed2: z.string().min(1),
  /** Set sim speed to 3× (Q1). */
  speed3: z.string().min(1),
  /** Pause / unpause the sim — also the Q2 countdown "Fight now" (Q1). */
  togglePause: z.string().min(1),
  /** Arm "pick a target" mode; the next left-click sets the objective (J3). */
  setObjective: z.string().min(1),
  /** Clear the active objective (J3). */
  clearObjective: z.string().min(1),
});

export type KeybindingsConfig = z.infer<typeof KeybindingsSchema>;

export const KEYBINDING_DEFAULTS: KeybindingsConfig = KeybindingsSchema.parse(keybindingsJson);
