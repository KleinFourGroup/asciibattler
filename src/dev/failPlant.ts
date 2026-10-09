/**
 * 117.5i — THE PLANTED FAILURES (DEV only: main.ts reaches this module
 * through DEV-gated dynamic imports, so a production build carries neither
 * it nor the query). `?fail=<what>` makes the page fail the way a player's
 * might, so the failure plate (src/failure, src/ui/FailurePlate.ts) can be
 * read:
 *
 *   ?fail=webgl     no canvas gives a WebGL context: the boot fails in
 *                   three.js, as it does where WebGL is off or missing
 *   ?fail=font      the font files fail to load: the boot fails in the atlas
 *   ?fail=frame     two seconds into the first battle, every frame throws
 *   ?fail=context   two seconds into the first battle, the WebGL context is
 *                   lost and never restored
 *
 * Each plants the failure at the browser's edge or in the loop and leaves
 * the game's own handling to run. `fail` is no run dial, so `?fail=frame`
 * alone boots the menu and the battle is reached by playing; beside run
 * dials (`?fail=frame&seed=7&character=soldier`) the page boots the run.
 */

import type * as THREE from 'three';
import { secondsToTicks } from '../config';
import type { Game } from '../Game';

export const FAIL_PARAM = 'fail';

/** How far into the first battle the two running plants wait, so the board
 *  is moving when the page fails. */
const INTO_BATTLE_TICKS = secondsToTicks(2);

const planted = (what: string): string => `planted by ?${FAIL_PARAM}=${what}`;

const asked = (search: string): string | null => new URLSearchParams(search).get(FAIL_PARAM);

/** The two boot plants. Called before the atlas and the Game are built. */
export function plantBootFailure(search: string): void {
  const what = asked(search);
  if (what === 'webgl') {
    const real = HTMLCanvasElement.prototype.getContext as (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) => unknown;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type.startsWith('webgl') ? null : real.call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  } else if (what === 'font') {
    // The shape a missing font file has: `load` rejects with a NetworkError.
    document.fonts.load = () => Promise.reject(new DOMException(planted('font'), 'NetworkError'));
  }
}

/** What the running plants reach on the Game (all private there). */
interface GameInternals {
  readonly renderer: { onFrame: (dt: number) => void; readonly webgl: THREE.WebGLRenderer };
  readonly activeScene: { readonly world?: { readonly currentTick: number } | null } | null;
}

/** The two running plants. Called once the Game is built and its loop runs. */
export function plantRunFailure(search: string, game: Game): void {
  const what = asked(search);
  if (what !== 'frame' && what !== 'context') return;
  const { renderer } = game as unknown as GameInternals;
  const due = (): boolean =>
    ((game as unknown as GameInternals).activeScene?.world?.currentTick ?? 0) >= INTO_BATTLE_TICKS;
  const frame = renderer.onFrame;
  let lost = false;
  renderer.onFrame = (dt) => {
    frame(dt);
    if (!due()) return;
    if (what === 'frame') throw new Error(planted('frame'));
    if (lost) return;
    lost = true;
    renderer.webgl.forceContextLoss();
  };
}
