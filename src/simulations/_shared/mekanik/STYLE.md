# Mekanik — sim style guide

Topic-level visual conventions for `src/simulations/<sim>/` simulations whose
topic is `mekanik`. The companion file is [tokens.ts](./tokens.ts); read this
guide first, then import tokens from there.

The intent is **schematic line-art** — physics-textbook aesthetic, not
3D-realistic. Cleanest legibility for students; minimum SVG markup for whoever
maintains the codebase next.

## Palette

| Token | Use it for |
|---|---|
| `COLORS.navy` | Structural strokes, ceiling/mounting bars, top + bottom caps, scale tick lines, label text. |
| `COLORS.bodyFill` | Interior of instrument bodies (off-white so navy ticks stay legible). |
| `COLORS.hatch` | Diagonal hatch lines on the ceiling/wall mount. |
| `COLORS.indicator` | The single attention colour. Indicator arrows, over-scale cracks, "UPS!" alerts. **Don't use it for anything else** — its meaning is "look here, this is the live reading." |
| `COLORS.badgeFill` / `badgeText` | Blue rounded badges that display measured/input values (e.g. mass). |
| `COLORS.cardFill` / `cardBorder` | The outer card background when the sim is not already inside a parent panel. |

## Strokes

`STROKE.thin` for tick marks, `STROKE.medium` for body outlines and connecting
strings, `STROKE.thick` for the indicator triangle and emphasised lines,
`STROKE.bar` for ceiling bars and caps.

## Layout

- **viewBox**: portrait, fixed pixel coordinates. The current convention is
  `viewBox="0 0 320 520"` for vertical instruments. Use `preserveAspectRatio="xMidYMid meet"` so the harness can scale freely without warping. Pick fresh coordinates per sim if the apparatus isn't vertical — but stay roughly in the 300–520 range so sims feel like siblings on a topic page.
- **Anchor everything to the centerline** (`x = 160` in the 320-wide viewBox). It
  keeps composition predictable and resizes cleanly.
- **Top to bottom is gravity**: ceilings/mounts at low y, suspended things at
  high y. Don't invent sideways layouts unless the apparatus actually is sideways.

## Transitions

Mekanik sims are input-driven — derive visual quantities from `params` on every
render and let CSS animate the result. Use `TRANSITION.indicator` /
`TRANSITION.mass`. **No `requestAnimationFrame` loops** unless the physics is
genuinely time-dependent.

## Numbers

All on-screen numeric values use Danish format. Pull `formatDK` from
`@/lib/numbers` — never `toFixed` + manual replace.

## Accessibility

- Every sim's outer `<svg>` has `role="img"` and a live `aria-label` describing
  the current state in Danish (e.g. *"Dynamometer 10 N med 27 g hængende, viser
  0,265 N"*). Update the label on every parameter change so screen readers
  reflect the live reading.
- Don't rely on the indicator colour alone to communicate state. Pair it with
  position changes, text labels, or shape changes (the dynamometer's
  break-apart cracks are an example).

## Adding a new mekanik sim

1. Read this guide.
2. Import from `@/simulations/_shared/mekanik/tokens`.
3. If you find yourself reaching for a colour/spacing not in `tokens.ts`, add
   it here first and reference it — don't inline. If three sims have copy-pasted
   the same `<g>` (rule of three), extract a shared component into
   `_shared/mekanik/<name>.tsx` at that point, not before.
