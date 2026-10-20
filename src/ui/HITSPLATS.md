# Editing the hitsplats — a no-CSS-experience guide

**Hitsplats** are the little bits of text that float up off a unit when
something happens to it in battle: a **damage number**, a red **crit**, a cyan
**heal** (`+5`), a **DoT tick** (`~5` burn, `‡5` bleed, `☠5` poison — each in
its status colour), or the italic **"Miss"**. This guide is for changing how
they *look*. Everything here lives in one file:

```
src/ui/ui.css      ← the section that starts with ".hitsplat"
```

You don't need to know CSS going in — copy a value, tweak it, save, look.

---

## The 10-second loop

1. Make sure the game is running: `npm run dev`, then open the URL it prints.
2. Edit `src/ui/ui.css`, change a value, **save**. The page refreshes itself
   (no rebuild, no restart).
3. **You have to be in a battle to see a hitsplat.** Pick a map node and start
   the turn — the splats appear as units trade blows. (Plain damage numbers and
   misses are the most frequent, so those show up fastest.)

If a change doesn't seem to take, hard-refresh the page (`Ctrl+Shift+R`).

---

## The pieces

There's **one base style** and **one style per "kind."** The base sets the
defaults; each kind rule **only overrides the lines it lists** and inherits
everything else from the base.

| Kind | When it shows | The rule to edit |
|------|---------------|------------------|
| plain damage | a normal hit | `.hitsplat` (the **base** — there is no `--normal` rule) |
| crit | a critical hit | `.hitsplat--crit` |
| heal | an ability's heal, or a rejuvenate tick (`+N`) | `.hitsplat--heal` |
| burn / bleed / poison | a DoT tick (`~5` / `‡5` / `☠5`) | `.hitsplat--burn`, `--bleed`, `--poison` — **the colour is NOT here**: the overlay sets it inline from the status table (`statusColor` in `src/render/statusDisplay.ts`, the same hue as the unit's status pip); the prefix glyph is `HITSPLAT_PREFIX` in `src/render/fxRegistry.ts`, which reads a DoT's from the same table (its status's symbol, the one over its pip). The CSS rule carries only an amber fallback colour. |
| **miss** | a dodged strike ("Miss") | `.hitsplat--miss` |

Two gotchas worth knowing up front:

- **Plain damage numbers use the base `.hitsplat`** — there's no
  `.hitsplat--normal` rule, so if you want to restyle ordinary damage, edit
  `.hitsplat` itself.
- **Editing the base changes every kind** that doesn't override that line. E.g.
  bumping the base `font-size` enlarges damage **and** heal **and** burn (they
  don't set their own size), but **not** crit or miss (they do).

---

## Anatomy of one rule

Here's the Miss rule, annotated. Every property below is something you can copy
into any other kind:

```css
.hitsplat--miss {
  color: var(--color-miss-white);  /* the text colour (see "Colours" below)  */
  font-size: var(--text-20);       /* the size: 20px at the default text size */
  font-style: italic;              /* "italic" = slanted; "normal" = upright */
  font-weight: 800;                /* 400 = normal, 700 = bold, 900 = heaviest */
  letter-spacing: 0.02em;          /* nudge letters apart (optional; tiny effect) */
  text-shadow:                     /* the glow + outline (see below)         */
    0 0 8px rgb(from var(--color-miss-glow) r g b / 0.85),  /* a soft blue glow */
    0 0 3px rgba(0, 0, 0, 0.95),        /* a dark halo so it stays readable  */
    0 1px 2px rgba(0, 0, 0, 0.95);      /* a subtle drop shadow              */
}
```

**`var(--…)`** names a **token**: a value defined once in the `:root` block at
the top of `ui.css` and used by name everywhere else. Colours and text sizes
are always tokens below `:root`, and `npm test` holds the sheet to that
(`tests/ui-tokens.test.ts`): a `font-size` that isn't a `--text-*` token, or a
hex colour like `#eaf2ff`, written in a rule below `:root` fails it. So does a
text token, or a colour token that belongs to no palette (see "Colours"), that
no rule uses any more: delete it from `:root` too.

A text token's name is its size in px at the default text size, and the
player's **Text size** setting scales every one of them together, the
hitsplats' included.

**`text-shadow`** reads as `horizontal vertical blur colour`. `0 0 8px` means
"no offset, blurred 8px" — i.e. a glow ring. A bigger blur = softer/wider glow.
You can stack several shadows by separating them with commas (as above). To
**remove** a glow entirely, delete the coloured line and keep the dark ones for
legibility.

---

## Colours

Every colour is a token in the `:root` block, written there as a **hex** code
like `#eaf2ff`: six characters after the `#`, in pairs, red-red, green-green,
blue-blue, from `00` (none) to `ff` (full). So `#ff3131` is mostly red,
`#15f4ee` is green+blue (cyan), and `#fff` (short for `#ffffff`) is white.

A rule names the colour it wants as `var(--color-miss-white)`. For a
see-through version, as the glows are, write
`rgb(from var(--color-miss-glow) r g b / 0.85)`: the token's colour at an
opacity from `0` (invisible) to `1` (solid). Plain black and white shadows may
stay as `rgba(0, 0, 0, 0.95)`.

To recolour one kind, point its rule at another token. To change a colour
everywhere it's used, change the token's hex in `:root`. The tokens from
`--color-terminal-black` down to `--color-volt-yellow` mirror the game's
palette (`COLORS` in `src/render/palette.ts`), and a test fails unless the two
agree, so change one of those in both places; the tokens after them, the
miss's two among them, belong to no palette and change in `:root` alone.

The tokens in use (handy to stay on-theme):

| Colour | Token | Used by |
|--------|-------|---------|
| white | `--color-white` | plain damage |
| neon red | `--color-neon-red` | crit |
| cyan | `--color-flourescent-blue` | heal |
| amber | `--color-terminal-amber` | the DoT kinds' CSS **fallback** only — a live DoT number takes its status colour inline: `STATUS_DISPLAY` in `src/render/statusDisplay.ts` picks it (burn `EMBER_ORANGE`, bleed `BLOOD_CRIMSON`, poison `TOXIC_GREEN`), and its hex is in `src/render/palette.ts`, where the colourblind palette has its own; the unit's status pip follows |
| cool white | `--color-miss-white` | miss |
| blue glow | `--color-miss-glow` | miss |

---

## Recipes (copy, paste into the rule, tweak)

**Make a kind bigger / smaller** — point `font-size` at another text token
from `:root` (`--text-8-5` up to `--text-56`):
```css
font-size: var(--text-24);   /* was var(--text-20) */
```
A size with no token yet gets a new one in `:root`, in `rem` (`1rem` is 16px
at the default text size).

**Recolour it** — point `color` at another token:
```css
color: var(--color-buff-gold);
```

**Make it pop more** — turn up the glow (bigger blur, higher opacity):
```css
text-shadow:
  0 0 12px rgb(from var(--color-miss-glow) r g b / 1),
  0 0 3px rgba(0, 0, 0, 0.95);
```

**Make it calmer / less flashy** — drop the coloured glow, keep just the dark
outline, maybe shrink it:
```css
.hitsplat--miss {
  color: var(--color-gray-b0);   /* muted grey */
  font-size: var(--text-14);
  font-style: italic;
  text-shadow:
    0 0 3px rgba(0, 0, 0, 0.9),
    0 1px 2px rgba(0, 0, 0, 0.95);
}
```
(This one leaves `--color-miss-white` and `--color-miss-glow` unused, so
delete them from `:root` with it.)

**Make a number bold or un-bold** — `font-weight: 900;` (heavier) or `400;`
(normal).

**Slow down or speed up the float** (how long it lingers as it rises and fades):
this is the `0.6s` on the **base** rule, shared by every kind —
```css
.hitsplat {
  /* ...other lines... */
  animation: hitsplat-rise 0.6s ease-out forwards;   /* try 1s to linger */
}
```
To change the timing for **one kind only**, add this line to that kind's rule
instead:
```css
animation-duration: 1s;
```

**Change how far it floats up, or the fade-in/out** — that's the
`@keyframes hitsplat-rise` block just below the kind rules. `opacity` is the
fade (0 = invisible, 1 = solid) and the `translate(-50%, …%)` numbers move it
(more-negative second number = floats higher). This too is shared by all kinds.

**Reduced motion** — a player whose OS asks for less motion, or who sets
Motion to Reduced in the settings, gets `@keyframes hitsplat-still` instead
(the reduced-motion block at the END of ui.css):
the number appears in place and fades, same `0.6s`. If you change the base
duration above, change it there too — the number self-removes when its
animation ends, and a test (`tests/ui-motion.test.ts`) fails if the two
durations drift apart.

---

## What you *can't* change from this file

These live in the TypeScript, not the CSS — listed so you don't go hunting:

- **The words shown** — the `"Miss"` text is `hitsplat.miss` in
  `locales/en/ui.json`; the numbers themselves come from
  `src/render/BattleRenderer.ts` (search `spawnHitsplat`).
- **How high above the unit they start** (the glyph's visual top — the
  `aboveAnchor` lift in `spawnHitsplat`) and **the gap between several
  splats stacking on one unit** (`HITSPLAT_STACK_REM`) —
  `src/render/BattleRenderer.ts` / `src/render/UnitOverlayLayer.ts`.
- **Which event shows which kind/colour** (a miss → the `miss` style, etc.) —
  also `BattleRenderer.ts`.

---

## If something looks off

CSS is forgiving: a typo in one rule just means that rule is ignored — it won't
crash the game, and the other splats keep working. So if a change "did nothing,"
re-check that line for a missing `;` or a misspelled property.

To undo everything back to the last commit: `git checkout src/ui/ui.css`.
