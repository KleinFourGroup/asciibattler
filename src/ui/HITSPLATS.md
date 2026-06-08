# Editing the hitsplats — a no-CSS-experience guide

**Hitsplats** are the little bits of text that float up off a unit when
something happens to it in battle: a **damage number**, a red **crit**, a cyan
**heal** (`+5`), an amber **burn**, or the italic **"Miss"**. This guide is for
changing how they *look*. Everything here lives in one file:

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
| heal | an ability heal (`+N`) | `.hitsplat--heal` |
| burn | standing in fire | `.hitsplat--burn` |
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
  color: #eaf2ff;            /* the text colour (see "Colours" below)        */
  font-size: 20px;           /* bigger number = bigger text                  */
  font-style: italic;        /* "italic" = slanted; "normal" = upright       */
  font-weight: 800;          /* 400 = normal, 700 = bold, 900 = heaviest     */
  letter-spacing: 0.02em;    /* nudge letters apart (optional; tiny effect)  */
  text-shadow:               /* the glow + outline (see below)               */
    0 0 8px rgba(90, 160, 255, 0.85),   /* a soft blue glow                  */
    0 0 3px rgba(0, 0, 0, 0.95),        /* a dark halo so it stays readable  */
    0 1px 2px rgba(0, 0, 0, 0.95);      /* a subtle drop shadow              */
}
```

**`text-shadow`** reads as `horizontal vertical blur colour`. `0 0 8px` means
"no offset, blurred 8px" — i.e. a glow ring. A bigger blur = softer/wider glow.
You can stack several shadows by separating them with commas (as above). To
**remove** a glow entirely, delete the coloured line and keep the dark ones for
legibility.

---

## Colours

Two formats appear here:

- **Hex** like `#eaf2ff` — six characters after the `#`, in pairs:
  red-red, green-green, blue-blue, from `00` (none) to `ff` (full). So `#ff3131`
  is mostly red, `#15f4ee` is green+blue (cyan), `#ffffff` is white.
- **rgba(r, g, b, a)** like `rgba(90, 160, 255, 0.85)` — red/green/blue from
  `0`–`255`, then **a** = opacity from `0` (invisible) to `1` (solid). Used for
  the glows so they can be semi-transparent.

The palette already in use (handy to stay on-theme):

| Colour | Hex | Used by |
|--------|-----|---------|
| white | `#ffffff` | plain damage |
| neon red | `#ff3131` | crit |
| cyan | `#15f4ee` | heal |
| amber | `#ffb000` | burn |
| cool white | `#eaf2ff` | miss |

Don't want to think about hex? You can also just write common names —
`color: gold;`, `color: white;`, `color: orange;` all work.

---

## Recipes (copy, paste into the rule, tweak)

**Make a kind bigger / smaller** — change `font-size`:
```css
font-size: 24px;   /* was 20px */
```

**Recolour it** — change `color`:
```css
color: gold;       /* or any hex like #ffd700 */
```

**Make it pop more** — turn up the glow (bigger blur, higher opacity):
```css
text-shadow:
  0 0 12px rgba(90, 160, 255, 1),
  0 0 3px rgba(0, 0, 0, 0.95);
```

**Make it calmer / less flashy** — drop the coloured glow, keep just the dark
outline, maybe shrink it:
```css
.hitsplat--miss {
  color: #9aa3ad;   /* muted grey */
  font-size: 14px;
  font-style: italic;
  text-shadow:
    0 0 3px rgba(0, 0, 0, 0.9),
    0 1px 2px rgba(0, 0, 0, 0.95);
}
```

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

---

## What you *can't* change from this file

These live in the TypeScript, not the CSS — listed so you don't go hunting:

- **The words shown** (the `"Miss"` text, the damage numbers themselves) —
  `src/render/BattleRenderer.ts` (search `spawnHitsplat`).
- **How high above the unit they start** (`HITSPLAT_Y_OFFSET`) and **the gap
  between several splats stacking on one unit** (`HITSPLAT_STACK_PX`) —
  `src/render/BattleRenderer.ts` / `src/render/UnitOverlayLayer.ts`.
- **Which event shows which kind/colour** (a miss → the `miss` style, etc.) —
  also `BattleRenderer.ts`.

---

## If something looks off

CSS is forgiving: a typo in one rule just means that rule is ignored — it won't
crash the game, and the other splats keep working. So if a change "did nothing,"
re-check that line for a missing `;` or a misspelled property.

To undo everything back to the last commit: `git checkout src/ui/ui.css`.
