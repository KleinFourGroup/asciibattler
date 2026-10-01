/**
 * Hand the player a file: `text` as a download named `filename` (the run
 * journal's export, Round 8 spec D5). The browser saves it where it saves
 * downloads; nothing is sent anywhere.
 *
 * The link is put in the document for the click and taken out after it, and
 * the blob's URL is released a little later rather than at once: a browser
 * may start reading the blob only after the click handler has returned.
 */

const RELEASE_AFTER_MS = 10_000;

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), RELEASE_AFTER_MS);
}
