/**
 * The default of every in-game hotkey, validated at boot. Source of truth
 * at `config/keybindings.json`. The registry (`src/ui/Keybindings.ts`)
 * seeds from these, and the player's rebinds, a setting, override them.
 *
 * Values are `KeyboardEvent.code`s, which name the physical key (`KeyF` on
 * any layout), so a binding survives a Dvorak or AZERTY layout as a `key`
 * would not. The schema requires every action, so a missing default fails
 * at boot rather than leaving an action unbound; to add one, add it to
 * `KEYBIND_ACTIONS`, the schema and the JSON. The objective keys default to
 * E, F, H and T, clear of the WASD camera keys.
 */

import { z } from 'zod';
import keybindingsJson from '../../config/keybindings.json';

/** The rebindable in-game actions. The registry keys off the name, so the
 *  order is for reading only. */
export const KEYBIND_ACTIONS = [
  'speedHalf',
  'speed1',
  'speed2',
  'speed3',
  'togglePause',
  'engageObjective',
  'focusObjective',
  'holdObjective',
  'stopObjective',
  'toggleSectorMap',
  'showTooltip',
] as const;
export type KeybindAction = (typeof KEYBIND_ACTIONS)[number];

const KeybindingsSchema = z.object({
  /** Set the speed to 0.5×. A speed key for a step that is not enabled does
   *  nothing (`PlaybackSpeed.setSpeed`). */
  speedHalf: z.string().min(1),
  /** Set the speed to 1×. */
  speed1: z.string().min(1),
  /** Set the speed to 2×. */
  speed2: z.string().min(1),
  /** Set the speed to 3×. */
  speed3: z.string().min(1),
  /** Pause or resume; also the pre-battle countdown's Fight now, since the
   *  countdown is a pause that ends itself. */
  togglePause: z.string().min(1),
  /** Arm a target pick for an engage objective; the next left-click sets
   *  it. An unarmed left-click on the board does the same. */
  engageObjective: z.string().min(1),
  /** Arm a target pick for a focus objective; the next left-click sets it.
   *  A right-click on the board does the same. */
  focusObjective: z.string().min(1),
  /** Set a hold objective: units act in place, with no target. */
  holdObjective: z.string().min(1),
  /** Return the team to the at-will default. */
  stopObjective: z.string().min(1),
  /** Toggle the read-only sector map. `Game` subscribes it, not a scene, so
   *  the map opens from any screen. */
  toggleSectorMap: z.string().min(1),
  /** Pin the open tooltip, close a pinned one, or open one pinned for the
   *  focused or hovered trigger (`toggleTooltipKey`, src/ui/tooltip.ts).
   *  `Game` subscribes it, like the map key. `Slash` is the `?` key, and
   *  dispatch is by code, so no shift is needed. */
  showTooltip: z.string().min(1),
});

type KeybindingsConfig = z.infer<typeof KeybindingsSchema>;

export const KEYBINDING_DEFAULTS: KeybindingsConfig = KeybindingsSchema.parse(keybindingsJson);
