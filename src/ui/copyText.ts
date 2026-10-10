/**
 * 118f — put text on the player's clipboard, by whichever way the page is
 * let. The clipboard API is asked first. A page in another site's frame can
 * be refused it (itch's frame is the case this is for), and a page that is
 * no secure context has none, so the old command is the second way: the
 * text selected in a field and the document asked to copy the selection.
 * `false` means both were refused, and the caller hands the text over some
 * other way.
 *
 * Call it from a click's own handler: both ways want the click behind them.
 */

export interface CopySteps {
  /** The clipboard API's write; null on a page that has none. */
  readonly clipboard: ((text: string) => Promise<void>) | null;
  /** The old command. False, or a throw, is a refusal. */
  readonly command: (text: string) => boolean;
}

/** The two ways in order; the page's own are `copyText`'s. */
export async function copyBy(steps: CopySteps, text: string): Promise<boolean> {
  if (steps.clipboard !== null) {
    try {
      await steps.clipboard(text);
      return true;
    } catch {
      // Refused: the old command is next.
    }
  }
  try {
    return steps.command(text);
  } catch {
    return false;
  }
}

/**
 * Copy `text`. `host` takes the field the old command selects from for as
 * long as the command runs: an element inside whatever holds the focus (an
 * open modal), so the selection is not made outside a focus trap.
 */
export function copyText(text: string, host: HTMLElement): Promise<boolean> {
  const clipboard = (navigator as { clipboard?: { writeText?: (text: string) => Promise<void> } }).clipboard;
  return copyBy(
    {
      clipboard: typeof clipboard?.writeText === 'function' ? (value) => clipboard.writeText!(value) : null,
      command: (value) => {
        const focused = document.activeElement;
        const field = document.createElement('textarea');
        field.value = value;
        field.readOnly = true;
        // In the page and selectable, and out of sight: a hidden field
        // can't be selected from.
        field.style.position = 'fixed';
        field.style.opacity = '0';
        field.style.pointerEvents = 'none';
        field.setAttribute('aria-hidden', 'true');
        field.tabIndex = -1;
        host.appendChild(field);
        try {
          field.select();
          return document.execCommand('copy');
        } finally {
          field.remove();
          if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
        }
      },
    },
    text,
  );
}
