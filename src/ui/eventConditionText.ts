/**
 * 100e — the event-condition requirement PHRASES ("10+ bits", "the daemon
 * Idol of Mars", "not the \"whispering-terminal:answered\" mark"), moved
 * out of src/config/events.ts (where 74f put them) so the config module
 * carries no player-facing prose: the §95 division is config prose in
 * `prose()` sidecars, UI copy in `locales/en/ui.json` through `t()` — and
 * this is UI copy (the Round 7 kickoff audit called it out; the literal
 * scan had to reach into `src/config/` for this one file).
 *
 * Deliberately phrases, not sentences: `event.requires` prefixes them and
 * the `not` combinator composes through `event.cond.not` without grammar
 * surgery. The 74h event editor (tools/event-editor) reuses them — the same
 * copy in both places. Names resolve through the sibling catalogs with an
 * id fallback — the boot-time `assertEventRefs` means a shipped def never
 * falls back. Flag phrases show the raw namespaced flag (dev-grade copy,
 * as before). Numbers ride `t()`'s Intl formatting (a 1000-bit threshold
 * would now read "1,000+ bits" — none is authored).
 */

import type { EventCondition } from '../config/events';
import { DAEMONS } from '../config/daemons';
import { packetById } from '../config/packets';
import { characterById } from '../config/characters';
import { t } from '../i18n/ui';

export function describeEventCondition(cond: EventCondition): string {
  switch (cond.kind) {
    case 'bitsAtLeast':
      return t('event.cond.bitsAtLeast', { amount: cond.amount });
    case 'poolHealthAtLeast':
      return t('event.cond.poolHealthAtLeast', { amount: cond.amount });
    case 'poolHealthAtMost':
      return t('event.cond.poolHealthAtMost', { amount: cond.amount });
    case 'hasDaemon':
      return t('event.cond.hasDaemon', {
        name: DAEMONS.find((d) => d.id === cond.daemonId)?.name ?? cond.daemonId,
      });
    case 'hasPacket':
      return t('event.cond.hasPacket', { name: packetById(cond.packetId)?.name ?? cond.packetId });
    case 'cacheHasRoom':
      return t('event.cond.cacheHasRoom');
    case 'rosterSizeAtLeast':
      return t('event.cond.rosterSizeAtLeast', { count: cond.count });
    case 'rosterSizeAtMost':
      return t('event.cond.rosterSizeAtMost', { count: cond.count });
    case 'characterIs':
      return t('event.cond.characterIs', {
        name: characterById(cond.characterId)?.name ?? cond.characterId,
      });
    case 'flagSet':
      return t('event.cond.flagSet', { flag: cond.flag });
    case 'flagIs':
      return t('event.cond.flagIs', { flag: cond.flag, value: JSON.stringify(cond.value) });
    case 'not':
      return t('event.cond.not', { inner: describeEventCondition(cond.condition) });
  }
}
