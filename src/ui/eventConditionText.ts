/**
 * The event conditions' requirement phrases ("10+ bits", "the daemon Idol
 * of Mars", "not the \"whispering-terminal:answered\" mark"). They are UI
 * copy, so they live here and not in src/config/events.ts: config prose
 * goes in `prose()` sidecars, and UI copy in `locales/en/ui.json` through
 * `t()`, so the config modules carry no player-facing prose.
 *
 * Phrases, not sentences: `event.requires` prefixes them, and the `not`
 * combinator composes through `event.cond.not` with no grammar to repair.
 * The event editor (tools/event-editor) shows the same phrases. Names
 * resolve through the sibling catalogs with an id fallback; the boot's
 * `assertEventRefs` means a shipped def never falls back. A flag's phrase
 * shows the raw namespaced flag (developer-grade copy). Numbers go through
 * `t()`'s Intl formatting, so a 1000-bit threshold would read "1,000+
 * bits" (none is authored).
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
