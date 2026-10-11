# The itch page's settings

What the itch.io project page is set to, beside its text
([page.md](page.md)). The page's address is kept out of this repo, as
the deploy's is (AGENTS.md "The project"). The upload itself is done by hand; README "The
itch build and the diagnostics build" has the zip.

itch's own page on HTML5 embeds would not load for the session that wrote
this (2026-10-10), so the option names below are from memory of the form
and may differ from what it shows.

## Decided

Signed by the user, 2026-10-10, the four rows the session suggested
among them (mobile, scrollbars, the start, the status).

- **Kind of project:** HTML, played in the browser.
- **The upload:** the plain zip that `node scripts/itch-zip.mjs` makes,
  not the `--diag` one, marked as the file played in the browser.
- **Embed:** in the page, 1280 × 720, which is the smallest window the
  game supports (DESIGN "The smallest window, and room for the columns").
- **Fullscreen button:** on. It is the way in for a screen the frame does
  not fit.
- **Comments:** on. The page's Feedback section sends players to them.
- **AI disclosure:** yes, with Code alone (the user's reading,
  2026-10-10: Text & Dialog means prose and character dialog, which are
  the user's; the functional text and the synthesized sounds' generator
  are code assistance, and the page's own AI Disclosure section says so).
- **Visibility:** a draft until the browser smoke has passed; the user
  opens it after.

- **Mobile friendly:** off. The game needs 1280 × 720 and a mouse.
- **Scrollbars:** off. A screen taller than the frame scrolls inside
  itself.
- **Start:** on a click, not on page load. The click gives the frame the
  keyboard, which the hotkeys need.
- **Release status:** in development.

## The user's to make

The short description, the genre and tags, the cover image, the
screenshots or a clip (`npm run record`, README "Recording clips"), the
price.

## At each upload

1. `node scripts/itch-zip.mjs`, and upload the zip it names.
2. Paste [page.md](page.md)'s text if it changed.
3. Open the draft and read the build's ID in the menu's corner against
   the zip's name.
