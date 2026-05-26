// Visual playground for HintBucket + Tjek disabled styles. devOnly — surfaces
// candidate variants side-by-side so a maintainer can pick one without
// rebuilding the lab. No Runner dependency: every variant is a static mock
// with the same Tailwind classes the real components use.
//
// Locked-in scheme:
//   - shade: slate-100 + slate-300 border (matches PhaseStepper locked + footer
//     fully-disabled).
//   - phase-disabled: NOT RENDERED — author explicitly disabled hints, no
//     affordance needed.
//   - bulb family: hand-drawn Bulb / BulbCracked / BulbFilling at 20 px
//     (`h-5 w-5`); disabled bulbs dimmed to `opacity-60`.
//   - countdown: bulb fills bottom-up over the replenish cycle; M:SS lives in
//     the tooltip only.
//   - depleted: cracked-bulb SVG (src/icons/BulbCracked).
//   - no-targets: yellow bulb at opacity-60 + tooltip.
import { Bulb } from '@/icons/Bulb';
import { BulbCracked } from '@/icons/BulbCracked';
import { BulbFilling } from '@/icons/BulbFilling';
import type { ReactNode } from 'react';

/* ============================================================
   HintBucket state mocks — production-matching.
   ============================================================ */

const DISABLED_SHELL =
  'inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed transition-colors';

const ARMABLE_SHELL =
  'inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium border-accent-400 bg-white text-slate-700 hover:bg-accent-50 transition-colors';

const BULB_SIZE = 'h-5 w-5';

function BucketArmable() {
  return (
    <button type="button" className={ARMABLE_SHELL}>
      <Bulb className={BULB_SIZE} />
      <span className="tabular-nums">3</span>
    </button>
  );
}

/** Countdown — bulb fills bottom-up at production opacity-60. M:SS in tooltip
 *  only. Accepts an optional fillColor so the colour test can swap candidates. */
function BucketCountdown({ fillPct, fillColor }: { fillPct: number; fillColor?: string }) {
  return (
    <button type="button" className={DISABLED_SHELL}>
      <BulbFilling fillPct={fillPct} fillColor={fillColor} className={`${BULB_SIZE} opacity-60`} />
    </button>
  );
}

/** Depleted — cracked bulb + "0". */
function BucketDepleted() {
  return (
    <button type="button" className={DISABLED_SHELL}>
      <BulbCracked className={`${BULB_SIZE} opacity-60`} />
      <span className="tabular-nums">0</span>
    </button>
  );
}

/** No-targets — same Bulb as armable, dimmed to opacity-60. */
function BucketNoTargets() {
  return (
    <button type="button" className={DISABLED_SHELL}>
      <Bulb className={`${BULB_SIZE} opacity-60`} />
      <span className="tabular-nums">3</span>
    </button>
  );
}

/* ============================================================
   Tjek button state mocks — scheme B (slate-100 + tooltip-only).
   ============================================================ */

const TJEK_BASE = 'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors';
const TJEK_ARMED = `${TJEK_BASE} bg-white border-accent-400 text-slate-700 hover:bg-accent-50`;
const TJEK_DIM = `${TJEK_BASE} bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed`;

function TjekArmed() {
  return (
    <button type="button" className={TJEK_ARMED}>
      Tjek mine variable
    </button>
  );
}

function TjekEmpty() {
  return (
    <button type="button" className={TJEK_DIM}>
      Tjek mine variable
    </button>
  );
}

function TjekClean() {
  return (
    <button type="button" className={TJEK_DIM}>
      Tjek mine variable
    </button>
  );
}

function TjekGateLocked() {
  return (
    <button type="button" className={TJEK_DIM}>
      Næste fase →
    </button>
  );
}

/** PhaseStepper locked circle — the design-system anchor for "fully locked"
 *  (slate-100). Reproduced in the playground so candidate chrome can be read
 *  against it. */
function StepperLocked() {
  return (
    <span className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-sm font-medium text-slate-400">
      3
    </span>
  );
}

/* ============================================================
   Layout primitives.
   ============================================================ */

function Cell({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      {children}
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <span className="inline-flex h-9 items-center rounded-md border border-dashed border-slate-300 px-3 text-xs italic text-slate-500">
      {label}
    </span>
  );
}

/* ============================================================
   BulbFilling colour candidates — drives the colour-test row.
   ============================================================ */

type ColorCandidate = { name: string; value: string };

const BULB_FILL_CANDIDATES: ColorCandidate[] = [
  { name: '#fdd477 (current)', value: '#fdd477' },
  { name: '#fdb800 (Bulb outline)', value: '#fdb800' },
  { name: '#facc15 (yellow-400)', value: '#facc15' },
  { name: '#eab308 (yellow-500)', value: '#eab308' },
  { name: '#fbbf24 (amber-400)', value: '#fbbf24' },
  { name: '#f59e0b (amber-500)', value: '#f59e0b' },
];

export function DisabledStylePlayground() {
  return (
    <div className="space-y-10">
      <section className="rounded-md border border-slate-200 bg-slate-50/40 p-3">
        <h3 className="font-mono text-sm text-navy mb-3">
          Design-system anchor — locked-stepper precedent
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Both HintBucket and Tjek share the locked PhaseStepper's shell:{' '}
          <code className="rounded bg-slate-200 px-1">bg-slate-100 border-slate-300</code>. The
          stepper stays on-screen so further chrome tweaks can be eyeballed against it.
        </p>
        <div className="flex flex-wrap items-end gap-6">
          <Cell sub="PhaseStepper locked">
            <StepperLocked />
          </Cell>
        </div>
      </section>

      <section>
        <h3 className="font-mono text-sm text-navy mb-3">HintBucket — production states</h3>
        <p className="mb-4 text-sm text-slate-600">
          Reference (armable) on the left. The four disabled reasons each get a state-specific
          render:
        </p>
        <ul className="mb-4 list-disc pl-5 text-sm text-slate-600 space-y-1">
          <li>
            <strong>phase</strong> — not rendered (author explicitly disabled hints).
          </li>
          <li>
            <strong>countdown</strong> — bulb fills bottom-up; M:SS in tooltip only.
          </li>
          <li>
            <strong>depleted</strong> — cracked bulb + "0" count.
          </li>
          <li>
            <strong>no-targets</strong> — faint yellow bulb (opacity-60) + count, tooltip explains.
          </li>
        </ul>

        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold text-navy">All states</div>
          <div className="flex flex-wrap items-end gap-6">
            <Cell sub="armable (ref)">
              <BucketArmable />
            </Cell>
            <Cell sub="phase">
              <Placeholder label="not rendered" />
            </Cell>
            <Cell sub="countdown (50%)">
              <BucketCountdown fillPct={50} />
            </Cell>
            <Cell sub="depleted">
              <BucketDepleted />
            </Cell>
            <Cell sub="no-targets">
              <BucketNoTargets />
            </Cell>
            <Cell sub="stepper locked">
              <StepperLocked />
            </Cell>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold text-navy">
            Countdown progression — bulb fills over the replenish cycle
          </div>
          <div className="mb-3 text-xs text-slate-500">
            Static snapshots at sample fill levels (production opacity-60). In the real component
            the fill ticks once per second via the existing 1 Hz <code>hintTick</code>.
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <Cell sub="0% (just spent)">
              <BucketCountdown fillPct={0} />
            </Cell>
            <Cell sub="15%">
              <BucketCountdown fillPct={15} />
            </Cell>
            <Cell sub="35%">
              <BucketCountdown fillPct={35} />
            </Cell>
            <Cell sub="60%">
              <BucketCountdown fillPct={60} />
            </Cell>
            <Cell sub="85%">
              <BucketCountdown fillPct={85} />
            </Cell>
            <Cell sub="100% (token granted)">
              <BucketCountdown fillPct={100} />
            </Cell>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold text-navy">
            BulbFilling colour test — which yellow reads best at opacity-60 / 50% fill?
          </div>
          <div className="mb-3 text-xs text-slate-500">
            Same bulb, same shell, same fillPct. Only the yellow swatch varies. The visible signal
            is the rising fill against slate-100 — pick the one that pops without clashing with the
            border. Top row: live render. Bottom row: the raw swatch.
          </div>
          <div className="flex flex-wrap items-end gap-6">
            {BULB_FILL_CANDIDATES.map((c) => (
              <Cell key={c.value} sub={c.name}>
                <BucketCountdown fillPct={50} fillColor={c.value} />
              </Cell>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {BULB_FILL_CANDIDATES.map((c) => (
              <div key={c.value} className="flex flex-col items-center gap-1">
                <span
                  aria-hidden
                  className="inline-block h-6 w-10 rounded border border-slate-300"
                  style={{ backgroundColor: c.value, opacity: 0.6 }}
                />
                <span className="font-mono text-[10px] text-slate-500">{c.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-6">
            <span className="text-xs text-slate-500">100% fill, for endpoint check:</span>
            {BULB_FILL_CANDIDATES.map((c) => (
              <Cell key={c.value} sub={c.value}>
                <BucketCountdown fillPct={100} fillColor={c.value} />
              </Cell>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-mono text-sm text-navy mb-3">
          Tjek button — scheme B (slate-100 + tooltip-only)
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Reference (armed Tjek) on the far left. All three dim states share the same shell;
          tooltips carry the reason.
        </p>
        <div className="rounded-md border border-slate-200 p-3">
          <div className="flex flex-wrap items-end gap-6">
            <Cell sub="armed (ref)">
              <TjekArmed />
            </Cell>
            <Cell sub="empty">
              <TjekEmpty />
            </Cell>
            <Cell sub="clean">
              <TjekClean />
            </Cell>
            <Cell sub="gate-locked">
              <TjekGateLocked />
            </Cell>
            <Cell sub="stepper locked">
              <StepperLocked />
            </Cell>
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-mono text-sm text-navy mb-3">
          Side-by-side: HintBucket + Tjek (both on slate-100)
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Family gut check: the locked-in HintBucket states + the Tjek dim states, all rendered
          against the PhaseStepper anchor.
        </p>
        <div className="rounded-md border border-slate-200 p-3">
          <div className="flex flex-wrap items-end gap-6">
            <Cell sub="HintBucket countdown (50%)">
              <BucketCountdown fillPct={50} />
            </Cell>
            <Cell sub="HintBucket depleted">
              <BucketDepleted />
            </Cell>
            <Cell sub="HintBucket no-targets">
              <BucketNoTargets />
            </Cell>
            <Cell sub="Tjek empty">
              <TjekEmpty />
            </Cell>
            <Cell sub="Tjek clean">
              <TjekClean />
            </Cell>
            <Cell sub="Tjek gate-locked">
              <TjekGateLocked />
            </Cell>
            <Cell sub="Stepper locked">
              <StepperLocked />
            </Cell>
          </div>
        </div>
      </section>
    </div>
  );
}
