# Icons

Loaded on demand when files under `src/icons/` are read.

Each icon is a typed React component (`.tsx`) that renders inline SVG. Consumers size it via Tailwind (`className="w-5 h-5"`) and colour it via `currentColor` inherited from the parent. No `vite-plugin-svgr` — we keep the icon set hand-rolled until it crosses ~15 entries.

## Authoring a new icon

```tsx
// src/icons/Beaker.tsx
import type { SVGProps } from 'react';

export function Beaker(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      <title>Bæger</title>
      <path d="..." />
    </svg>
  );
}
```

Rules:

- Root `<svg>` keeps only `viewBox` (no inline `width`/`height` — let CSS size it).
- **Monochrome icons** use `currentColor` for `fill`/`stroke` so they track the parent's text colour.
- **Illustrative / branded icons** may carry their own palette. Embed colours via a `<style>{`…`}</style>` child block, prefix the classes (e.g. `.bk-l`, `.pd-l`) so they don't collide with other inline-SVG styles in the DOM, and include a `@media (prefers-color-scheme:dark)` override so the icon adapts. See `TheoryClosed.tsx` for the pattern.
- Always set `aria-hidden focusable="false"` — the consumer's button label is the accessible name.
- Include a `<title>` child with a short noun-phrase label (Biome's `noSvgWithoutTitle` enforces it). Hover tooltip is a small bonus; `aria-hidden` keeps screen readers from announcing it.
- Spread `{...props}` last so callers can override `className`, attach `data-*`, etc.
- Filenames + component names are `PascalCase`, noun-first (`Beaker.tsx`, not `BeakerIcon.tsx`). State-bearing icons use a trailing suffix (`TheoryOpen`, `TheoryClosed`).

No barrel file. Import directly: `import { Beaker } from '@/icons/Beaker'`. Add an `index.ts` only if the import list becomes unmanageable (~20+ icons in a single file).

## Source SVGs

Raw `.svg` files live under `src/icons/sources/`, named to match their `.tsx` component (`TheoryClosed.svg` ↔ `TheoryClosed.tsx`). Grep for the name and you find both. The `.svg` is the design source — open it in Figma / Inkscape / your editor of choice. The `.tsx` is what gets imported by consumers; it wraps the SVG markup with our project-specific concerns (`<title>`, `aria-hidden`, class-prefix namespacing, `{...props}` spread).

## Updating an existing icon

1. Edit `src/icons/sources/<Name>.svg` in your design tool. Keep `viewBox="0 0 24 24"` and the `<style>` block structure (class names + dark-mode media query).
2. Run the file through [SVGOMG](https://jakearchibald.github.io/svgomg/) to strip editor metadata. Keep `viewBox`; let it remove `id`s, comments, namespaces.
3. Open the matching `src/icons/<Name>.tsx` and update the body:
   - Copy the `<style>` block contents into the `const styles = …` template literal.
   - Replace each child element (`<rect>`, `<path>`, `<circle>`, …) with the new markup.
   - JSX-ify attribute names: `stroke-width` → `strokeWidth`, `stroke-linecap` → `strokeLinecap`, `stroke-linejoin` → `strokeLinejoin`, `stroke-opacity` → `strokeOpacity`, `stroke-dasharray` → `strokeDasharray`, `fill-opacity` → `fillOpacity`, `class` → `className`.
   - **Namespace the CSS classes** (e.g. `.l` → `.bk-l`, `.f` → `.bk-f`) so they don't collide with other inline-SVG `<style>` blocks rendered on the same page. Books use `bk-*`; pendulum uses `pd-*`; pick a new short prefix for a new icon family.
4. `npm run lint` — Biome catches missing `<title>` elements and JSX formatting drift.
5. Verify visually with `npm run dev` and a screenshot of `/emner/test-labs/reference`.

## Adding a new icon

Same as above but step 3 means *creating* the new `<Name>.tsx` from the template at the top of this file. Then add an import where you want to use it.

## Revisit trigger

When the count crosses ~15 icons, or design hand-off needs raw `.svg` drops with no manual conversion, switch to `vite-plugin-svgr`: rename each `.tsx` → `.svg`, update imports, remove the manual component scaffolding. At that point the `src/icons/sources/` folder becomes the only `.svg` location.
