/**
 * The bot's walk of the pre-turn gate's grants and its purchases at a port,
 * shared by the fuzz harness (`runOne`) and the rollout walker, so a rollout
 * plays these gates as the run it branches from does.
 */

import type { RNG } from '../../src/core/RNG';
import type { RunCommand } from '../../src/run/Command';
import type { PortStock, Run } from '../../src/run/Run';
import type { TurnGrantView } from '../../src/run/daemon';
import { selectEmpowerPosition, type EmpowerPolicy } from './empowerPolicy';
import { selectRedrawPositions, type RedrawPolicy } from './redrawPolicy';
import type { FuzzStrategy, GrantAction, PortBuy } from './Strategy';

/** What to spend on the grant at `grantIndex` next, or `null` to stop. */
export type GrantChoice = (grantIndex: number, grant: TurnGrantView) => GrantAction | null;

/**
 * Walks the grant queue in acquisition order, which either finality mode
 * accepts. Each grant is asked until `choose` returns `null` or its budget is
 * spent; a dispatch that moves no budget was rejected, and ends that grant's
 * asks, so no loop can spin. A grant still active with budget left is then
 * passed, since under strict finality it would block the grants after it
 * (free finality makes the pass a no-op).
 */
export function walkGrants(run: Run, choose: GrantChoice): void {
  for (let grantIndex = 0; grantIndex < run.grantViews().length; grantIndex++) {
    const view = () => run.grantViews()[grantIndex]!;
    for (;;) {
      const grant = view();
      if (grant.remaining <= 0) break;
      const action = choose(grantIndex, grant);
      if (action === null) break;
      const before = grant.remaining;
      run.dispatch(
        action.kind === 'redraw'
          ? { kind: 'redrawCards', handIndices: [...action.handIndices], grantIndex }
          : { kind: 'empowerUnit', handIndex: action.handIndex, grantIndex },
      );
      if (view().remaining === before) break;
    }
    if (view().active && view().remaining > 0) {
      run.dispatch({ kind: 'passGrant' });
    }
  }
}

/**
 * The redraw and empower policies as a `GrantChoice`: each spends only the
 * grants of its own kind, and only with its stream; an absent policy, or one
 * of kind `none`, spends nothing and draws nothing.
 */
export function policyGrantChoice(
  run: Run,
  redraw: RedrawPolicy | undefined,
  redrawRng: RNG | null,
  empower: EmpowerPolicy | undefined,
  empowerRng: RNG | null,
): GrantChoice {
  return (_grantIndex, grant) => {
    const effect = grant.effect;
    if (effect.kind === 'redraw' && redraw && redrawRng) {
      const hand = run.hand.map((i) => run.team[i]!);
      const pool = [...run.drawPile, ...run.discardPile].map((i) => run.team[i]!);
      const positions = selectRedrawPositions(
        hand,
        pool,
        { redrawsRemaining: grant.remaining, cardsRemaining: effect.maxCards },
        redraw,
        redrawRng,
      );
      return positions.length === 0 ? null : { kind: 'redraw', handIndices: positions };
    }
    if (effect.kind === 'empower' && empower && empowerRng) {
      const hand = run.hand.map((i) => run.team[i]!);
      const pos = selectEmpowerPosition(
        hand,
        { empowersRemaining: grant.remaining },
        empower,
        empowerRng,
      );
      return pos === null ? null : { kind: 'empower', handIndex: pos };
    }
    return null;
  };
}

/** The command that makes a `PortBuy`. */
export function portBuyCommand(buy: PortBuy): RunCommand {
  return buy.kind === 'daemon'
    ? { kind: 'buyPortDaemon', index: buy.index }
    : buy.kind === 'unit'
      ? { kind: 'buyPortUnit', index: buy.index }
      : { kind: 'buyPortPacket', index: buy.index };
}

/**
 * The strategy's purchases at a port: one proposal per ask, against the live
 * stock and bits, asked again after each buy that lands. A buy lands when its
 * slot's sold flag flips; one that doesn't (unaffordable, the cache full)
 * ends the asks, so the loop cannot spin. Returns how many landed; a strategy
 * with no `pickPortBuy` buys nothing.
 */
export function buyAtPort(run: Run, stock: PortStock, strategy: FuzzStrategy, rng: RNG): number {
  let bought = 0;
  for (;;) {
    const buy = strategy.pickPortBuy?.(stock, run, rng) ?? null;
    if (buy === null) return bought;
    const lane =
      buy.kind === 'daemon' ? stock.daemons : buy.kind === 'unit' ? stock.units : stock.packets;
    const slot = lane[buy.index];
    if (slot === undefined || slot.sold) return bought;
    run.dispatch(portBuyCommand(buy));
    if (!slot.sold) return bought;
    bought++;
  }
}
