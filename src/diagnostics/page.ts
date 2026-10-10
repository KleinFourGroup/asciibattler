/**
 * 118f — the page's own readings for the player's diagnostics (report.ts):
 * where the game runs and in what. Each is read when the report is asked
 * for, and `diagnosticsReport` guards the call, so a browser that refuses
 * one of these costs the report this field and no other.
 */

import type { PageReading } from './report';

export function pageReading(): PageReading {
  return {
    origin: location.origin,
    embedded: window.self !== window.top,
    userAgent: navigator.userAgent,
    language: navigator.language,
    window: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}`,
    screen: `${window.screen.width}x${window.screen.height}`,
  };
}
