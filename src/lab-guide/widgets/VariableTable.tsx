// Student-facing variable identification widget: three sections (IV, DV,
// constants), each independently configurable. By default IV and DV are
// single fixed rows and constants are 0..∞ student-added rows; authors can
// override per-section with `{ count: N }` for a fixed row count, or
// `{ min, max }` to let the student pick. The widget registers a `filled`
// widget state whenever every visible IV/DV cell is non-empty (and unit
// cells too when `requireUnits` is true), the row-count for each section
// falls in `[min, max]`, and — when the author set the `constants` prop —
// every visible constant row is filled.
//
// The `values` facet on the registration publishes a uniform array shape
// `{ iv: VariableEntry[], dv: VariableEntry[], constants: VariableEntry[] }`
// so sibling widgets (e.g. the template's hypothesis section) can read it
// the same way regardless of section count. Gate evaluators ignore `values`.
//
// Optional `expected` prop opts in to correctness checking + the Tjek flow.
// Lock model: clicking Tjek is the *event* that commits correctness. For
// every configured (`expectedRow[cell]` defined) cell:
//   - correct + filled → cell locks into a `readOnly` input styled as plain
//     text and flashes emerald for 1.5s. Unlock via double-click, Enter/F2 on
//     focus, or a 500ms long-press; the previously-rendered editable input
//     takes focus on unlock so a keyboard student can resume typing.
//   - wrong + filled → cell stays editable and flashes rose for 1.5s.
//   - empty → ignored (no flash, no lock).
// The widget publishes `correct: true` iff every configured expected cell is
// locked AND its current `RowMatch` still reports the cell correct (so a
// removed-then-readded-with-wrong-values row never silently resurrects the
// gate from a stale lock entry). The `sections` facet follows the same rule
// per section. Locks live in `RunnerState.variableTableLocks` keyed by
// `${section}.${expectedIndex}.${cell}` — expected-row identity, the same
// scheme `variableTableHintTiers` / `variableTableHintReveals` use — so
// multi-row sections entered in any order pair the same way across all
// three slices. The matcher implementation lives in
// `variableTableCorrectness.ts`.
//
// Hint system: when `expected` is set, the widget participates in the
// request-driven hint system. Auto-bump on Tjek is gone — students arm spend
// mode via the bucket. While armed, every failing cell with a remaining ladder
// gets a faint amber border + becomes the spend target itself (click or Enter
// to spend, which exits spend mode and re-focuses the cell so the popup opens
// against the freshly-revealed tier). When idle, a small amber dot sits at the
// input's top-right corner whenever the popup will open on focus (paid reveals
// or live free diagnostics). Locked cells carry no hint chrome — no armed
// border, no idle dot, no popup. Free diagnostics (case-mismatch + whitespace-
// internal) appear in the focus popup without a token cost, gated on the same
// checked-and-not-dirty rule as paid hints.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useHintSpend } from '../HintSpendContext';
import { useRunner } from '../RunnerContext';
import { Tooltip } from '../Tooltip';
import { strings } from '../strings.da';
import { useRegisteredHintEligibility } from '../useRegisteredHintEligibility';
import { useRegisteredWidgetCheck } from '../useRegisteredWidgetCheck';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import type { WidgetCheck } from '../widgetCheck';
import { HintBucket } from './HintBucket';
import { RowGroupSection } from './VariableTableRows';
import {
  type Cell,
  type CorrectnessReport,
  type ExpectedVariables,
  asExpectedArray,
  evaluateTable,
} from './variableTableCorrectness';
import {
  type HintCtx,
  cellInfoFor,
  countSpendable,
  missingMessagesFor,
  resolveSpend,
} from './variableTableHints';
import {
  cellLockedForStudent,
  lockKeyForStudent,
  sectionFullyLockedCorrect,
} from './variableTableLocks';
import {
  type FlashPayload,
  type TjekDimReason,
  computeTjekOutcome,
  deriveTjekDimReason,
} from './variableTableTjek';
import {
  DEFAULT_CONSTANTS_BOUNDS,
  DEFAULT_DV_BOUNDS,
  DEFAULT_IV_BOUNDS,
  EMPTY,
  type Section,
  type SectionConfig,
  type VariableEntry,
  cellKey,
  clampExpected,
  readValues,
  resolveBounds,
  sectionFilled,
  valuesEqual,
  warnMalformed,
} from './variableTableValues';

export type { VariableEntry, VariableTableValues, SectionConfig } from './variableTableValues';

interface Props {
  id: string;
  /** When true, the `unit` cell on every visible IV and DV row must be filled
   *  for the widget to report `filled: true`. Constants ignore this flag.
   *  Default `false` because not all lab theories teach specific units. */
  requireUnits?: boolean;
  /** Optional author-supplied answer key. When set, the widget computes a
   *  `correct: boolean` + structured `errors` payload (in addition to the
   *  default `filled` bit) so an `all-validated` gate can require correct
   *  answers. `iv` / `dv` accept a single object or an array; constants is
   *  always an array. Each cell in each expected entry is independently
   *  optional — the author validates only what they care about. */
  expected?: ExpectedVariables;
  /** Per-section row-count config. Omit to keep today's behaviour: IV/DV are
   *  exactly one fixed row, constants are 0..∞ student-added. `{ count: N }`
   *  pins the row count (no +/× controls). `{ min, max }` lets the student
   *  add/remove rows within bounds. */
  iv?: SectionConfig;
  dv?: SectionConfig;
  constants?: SectionConfig;
  /** Per-instance label overrides (SPEC §17). Defaults live in strings.da.ts. */
  ivLabel?: string;
  dvLabel?: string;
  constantsLabel?: string;
  nameHeader?: string;
  symbolHeader?: string;
  unitHeader?: string;
  addConstantLabel?: string;
  addIvLabel?: string;
  addDvLabel?: string;
  removeConstantAriaLabel?: string;
  removeIvAriaLabel?: string;
  removeDvAriaLabel?: string;
  constantRowAriaLabel?: string;
  ivRowAriaLabel?: string;
  dvRowAriaLabel?: string;
  constantMissingMessage?: string;
  ivMissingMessage?: string;
  dvMissingMessage?: string;
  /** Empty-state copy shown inside the Konstanter section when it has zero
   *  rows. Default: `strings.widgets.variableTable.constantsEmptyMessage`
   *  ("Ingen konstanter tilføjet endnu."). Pass `""` (empty string) to
   *  explicitly disable the empty-state branch and fall back to the
   *  bare add-link render. SPEC §17. */
  constantsEmptyMessage?: string;
  /** Empty-state copy for the IV section. Undefined by default — IV defaults
   *  to a single fixed row so the empty-state is unreachable unless the
   *  author overrides `iv: { min: 0, … }`. SPEC §17. */
  ivEmptyMessage?: string;
  /** Empty-state copy for the DV section. Undefined by default — see
   *  `ivEmptyMessage`. SPEC §17. */
  dvEmptyMessage?: string;
  /** Tjek button label override (SPEC §17). Only rendered when `expected`
   *  is provided. */
  checkLabel?: string;
  /** Opt in to driving the Tjek from the shared PhaseFooter button instead of
   *  the in-widget button. Meaningful only when `expected` is set; ignored in
   *  open mode (the in-widget button stays so free-advance keeps self-check).
   *  Default `false`. */
  checkInFooter?: boolean;
  /** Tooltip on a locked cell (SPEC §17). Leading `Korrekt.` doubles as the
   *  AT announcement of the locked/correct state; the rest carries the
   *  unlock affordance. */
  lockedTooltip?: string;
  /** SR-only description on an armed-spendable cell — surfaced via
   *  aria-describedby while spend mode is armed AND the cell has an unspent
   *  tier. Tells AT users the whole input rectangle is the spend target. */
  armedSpendableAriaDescription?: string;
  /** SR-only live-region announcement on full-success Tjek. Reuses existing
   *  Danish copy verbatim; exists only as the SPEC §17 override knob. */
  checkedAriaStatusLabel?: string;
  /** SEN accommodation — propagated to cell inputs to bypass paste-block. */
  allowPaste?: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function VariableTable({
  id,
  requireUnits = false,
  expected,
  iv: ivConfig,
  dv: dvConfig,
  constants: constantsConfig,
  ivLabel,
  dvLabel,
  constantsLabel,
  nameHeader,
  symbolHeader,
  unitHeader,
  addConstantLabel,
  addIvLabel,
  addDvLabel,
  removeConstantAriaLabel,
  removeIvAriaLabel,
  removeDvAriaLabel,
  constantRowAriaLabel,
  ivRowAriaLabel,
  dvRowAriaLabel,
  constantMissingMessage,
  ivMissingMessage,
  dvMissingMessage,
  constantsEmptyMessage,
  ivEmptyMessage,
  dvEmptyMessage,
  checkLabel,
  checkInFooter = false,
  lockedTooltip,
  armedSpendableAriaDescription,
  checkedAriaStatusLabel,
  allowPaste,
}: Props) {
  const {
    state,
    setWidgetValue,
    spendAndRevealVtTier,
    setVariableTableLastChecked,
    lockVtCells,
    unlockVtCell,
    registerSpendableCount,
  } = useRunner();
  const { spendMode, exitSpendMode } = useHintSpend();

  const bounds = {
    iv: resolveBounds(ivConfig, DEFAULT_IV_BOUNDS),
    dv: resolveBounds(dvConfig, DEFAULT_DV_BOUNDS),
    constants: resolveBounds(constantsConfig, DEFAULT_CONSTANTS_BOUNDS),
  };
  const values = readValues(state.widgetValues[id], bounds);

  // Resolve + clamp expected arrays once per render.
  const ivExpectedArr = expected
    ? clampExpected(id, 'iv', asExpectedArray(expected.iv), bounds.iv)
    : [];
  const dvExpectedArr = expected
    ? clampExpected(id, 'dv', asExpectedArray(expected.dv), bounds.dv)
    : [];
  const constantsExpectedArr = expected?.constants
    ? clampExpected(id, 'constants', expected.constants, bounds.constants)
    : undefined;

  if (import.meta.env.DEV && expected) {
    warnMalformed(id, 'iv', ivExpectedArr);
    warnMalformed(id, 'dv', dvExpectedArr);
    if (constantsExpectedArr) warnMalformed(id, 'constants', constantsExpectedArr);
  }

  // Register as hint-eligible only when `expected` is set (no answer key →
  // no ladder → nothing to spend on).
  useRegisteredHintEligibility(id, expected !== undefined, 'vtCell');

  const ivFilled = sectionFilled(values.iv, bounds.iv, requireUnits);
  const dvFilled = sectionFilled(values.dv, bounds.dv, requireUnits);
  // PL11 carve-out: when the author did NOT pass a constants prop, the
  // constants section's filled contribution is unconditionally true (matches
  // today's behaviour where partial/blank constant rows don't block `filled`).
  const constantsFilled =
    constantsConfig === undefined ? true : sectionFilled(values.constants, bounds.constants, false);
  const filled = ivFilled && dvFilled && constantsFilled;

  const errors: CorrectnessReport | undefined = expected
    ? evaluateTable(values, {
        iv: ivExpectedArr,
        dv: dvExpectedArr,
        constants: constantsExpectedArr,
      })
    : undefined;

  // `lastChecked` snapshot still drives the free-diagnostic + paid-hint
  // reveal-vs-edit gating (`sectionClean` below). It no longer participates
  // in the `correct` definition — locks own correctness.
  const lastChecked = state.variableTableLastChecked[id];
  const sectionChecked = {
    iv: lastChecked !== undefined && valuesEqual(lastChecked.iv, values.iv),
    dv: lastChecked !== undefined && valuesEqual(lastChecked.dv, values.dv),
    constants: lastChecked !== undefined && valuesEqual(lastChecked.constants, values.constants),
  };

  const locks = state.variableTableLocks[id] ?? {};

  const ivLock = expected ? sectionFullyLockedCorrect(locks, errors, 'iv', ivExpectedArr) : null;
  const dvLock = expected ? sectionFullyLockedCorrect(locks, errors, 'dv', dvExpectedArr) : null;
  const constantsLock =
    expected && constantsExpectedArr
      ? sectionFullyLockedCorrect(locks, errors, 'constants', constantsExpectedArr)
      : null;

  const expectedTotal =
    (ivLock?.configured ?? 0) + (dvLock?.configured ?? 0) + (constantsLock?.configured ?? 0);
  const allExpectedLocked =
    (ivLock?.covered ?? true) && (dvLock?.covered ?? true) && (constantsLock?.covered ?? true);
  const correct =
    expected !== undefined ? filled && expectedTotal > 0 && allExpectedLocked : undefined;

  // Per-section satisfaction facet for the instruction-box step tracker
  // (sibling-read; gate evaluators ignore it). With `expected.<section>`
  // present, the boolean reads "every configured cell in the section is
  // locked-and-currently-correct". Without it, falls back to presence.
  const sections = {
    iv: expected ? ivFilled && (ivLock?.covered ?? false) : ivFilled,
    dv: expected ? dvFilled && (dvLock?.covered ?? false) : dvFilled,
    constants:
      expected && constantsExpectedArr
        ? constantsFilled && (constantsLock?.covered ?? false)
        : constantsFilled,
  };

  // Conditional spread: when `expected` is absent, omit the `correct`/`errors`
  // keys entirely (not `undefined`) so back-compat consumers can rely on
  // `'correct' in state` semantics.
  const widgetState =
    expected !== undefined
      ? ({ kind: 'filled', filled, correct, errors, values, sections } as const)
      : ({ kind: 'filled', filled, values, sections } as const);

  useRegisteredWidgetState(id, widgetState, [
    filled,
    correct ?? null,
    sections.iv,
    sections.dv,
    sections.constants,
    // Explicit errors key: technically redundant since cell-value deps below
    // already cover freshness (errors is purely derived), but documents intent
    // and survives future refactors that might drop cell-value deps.
    JSON.stringify(errors ?? null),
    JSON.stringify(values),
    JSON.stringify(locks),
  ]);

  function updateRow(
    section: 'iv' | 'dv' | 'constants',
    idx: number,
    field: keyof VariableEntry,
    next: string,
  ) {
    const rows = values[section].map((r, i) => (i === idx ? { ...r, [field]: next } : r));
    setWidgetValue(id, { ...values, [section]: rows });
  }
  function addRow(section: 'iv' | 'dv' | 'constants') {
    setWidgetValue(id, { ...values, [section]: [...values[section], { ...EMPTY }] });
  }
  function removeRow(section: 'iv' | 'dv' | 'constants', idx: number) {
    setWidgetValue(id, {
      ...values,
      [section]: values[section].filter((_, i) => i !== idx),
    });
  }

  // Per-Tjek flash state — emerald-on-newly-locked + rose-on-still-wrong. The
  // nonce remounts the wrapper so a repeat-Tjek with identical keys still
  // restarts the fade animation. The fade itself is a CSS keyframe
  // (`animate-vt-flash-fade` in globals.css) that interpolates the cell's
  // background-color from the static class value to transparent over 1500ms.
  // Under reduced motion the keyframe is suppressed and the colour stays
  // solid for the window. Cleared entirely after 1500ms.
  const [flash, setFlash] = useState<FlashPayload | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashNonceRef = useRef(0);

  const tjekDimReason = deriveTjekDimReason(
    values,
    sectionChecked,
    lastChecked !== undefined,
    expected !== undefined,
  );
  const tjekDimTooltip =
    tjekDimReason === 'empty'
      ? strings.widgets.variableTable.tjekDisabledEmpty
      : tjekDimReason === 'clean'
        ? strings.widgets.variableTable.tjekDisabledClean
        : undefined;

  // Clear any pending flash timer on unmount so a late tick can't call
  // setState on an unmounted widget (e.g. lab teardown mid-flash).
  useEffect(
    () => () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  function handleTjek() {
    if (!expected || !errors) return;
    // Dimmed Tjek is a no-op — the click hit a no-changes-or-empty state. Let
    // the dim affordance carry the signal; don't snapshot the values again.
    if (tjekDimReason !== null) return;
    setVariableTableLastChecked(id, values);

    const { newlyLocked, newlyUnlocked, flashKeys } = computeTjekOutcome({
      values,
      errors,
      expected: {
        iv: ivExpectedArr,
        dv: dvExpectedArr,
        constants: constantsExpectedArr ?? [],
      },
      locks,
    });

    if (newlyLocked.length > 0) lockVtCells(id, newlyLocked);
    for (const k of newlyUnlocked) unlockVtCell(id, k);

    const withTransition = !prefersReducedMotion();
    flashNonceRef.current += 1;
    const nonce = flashNonceRef.current;
    setFlash({ keys: flashKeys, nonce, withTransition });
    if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setFlash(null);
      flashTimerRef.current = null;
    }, 1500);
  }

  // Footer-check opt-in: when `checkInFooter` is set (and `expected` exists,
  // and we're not in open mode), the in-widget Tjek button is suppressed and
  // the PhaseFooter drives `handleTjek` instead. The check object is stable;
  // we mutate it in place each render so the footer reads the latest closure.
  // VariableTable's check is synchronous (never pending), but it CAN be dimmed
  // — empty cells, or no-edits-since-last-Tjek — so disabled+disabledReason
  // flow through to the footer's Tooltip wrap. The button flash itself fires
  // from the footer (on gate-unlock transition), not from the widget.
  const footerActive = checkInFooter && expected !== undefined && state.mode !== 'open';
  const checkRef = useRef<WidgetCheck>({
    label: '',
    run: () => {},
    disabled: false,
    pending: false,
  });
  checkRef.current.label = checkLabel ?? strings.widgets.variableTable.checkLabel;
  checkRef.current.run = handleTjek;
  checkRef.current.disabled = tjekDimReason !== null;
  checkRef.current.disabledReason = tjekDimTooltip;
  // Re-fire the registration whenever the dim reason changes so the footer
  // re-reads the live `disabled`/`disabledReason` (most state changes already
  // re-render the footer via runner dispatch; this is the belt-and-braces).
  const checkRevision = tjekDimReason === 'empty' ? 1 : tjekDimReason === 'clean' ? 2 : 0;
  useRegisteredWidgetCheck(id, footerActive, checkRef, checkRevision);

  const tiers = state.variableTableHintTiers[id] ?? {};
  const reveals = state.variableTableHintReveals?.[id] ?? {};
  // Per-section "clean snapshot" gate — Tjek was run and values haven't been
  // edited since. Used for live diagnostics + spend-target gating (spending
  // mid-edit hides what the student is paying for). Revealed paid strings
  // ignore this gate — once spent, the hint is paid for and stays visible
  // through every subsequent edit, including clearing the cell to retry.
  const sectionClean = {
    iv: expected !== undefined && sectionChecked.iv,
    dv: expected !== undefined && sectionChecked.dv,
    constants: expected !== undefined && sectionChecked.constants,
  };

  const hintCtx: HintCtx = {
    hasExpected: expected !== undefined,
    tiers,
    reveals,
    sectionClean,
  };

  // Live spendable-target count — number of failing cells with a remaining
  // ladder. HintBucket reads the phase-aggregate to disable when tokens > 0
  // but nothing is left to buy. cellInfoFor already gates `nextTier` on the
  // section being clean + the cell having an unspent tier, so locked /
  // matched / mid-edit cells naturally drop out.
  const spendableCount =
    expected && errors
      ? countSpendable(hintCtx, values, errors, {
          iv: ivExpectedArr,
          dv: dvExpectedArr,
          constants: constantsExpectedArr ?? [],
        })
      : 0;
  useEffect(() => {
    if (expected === undefined) return;
    registerSpendableCount(id, spendableCount);
    return () => registerSpendableCount(id, null);
  }, [id, expected, spendableCount, registerSpendableCount]);

  const nameH = nameHeader ?? strings.widgets.variableTable.nameHeader;
  const symbolH = symbolHeader ?? strings.widgets.variableTable.symbolHeader;
  const unitH = unitHeader ?? strings.widgets.variableTable.unitHeader;

  const showAriaStatus = correct === true;
  const ariaStatusLabel =
    checkedAriaStatusLabel ?? strings.widgets.variableTable.checkedAriaStatusLabel;
  const resolvedArmedAria =
    armedSpendableAriaDescription ?? strings.widgets.hints.armedSpendableAriaDescription;
  // Author override (`lockedTooltip` prop) renders verbatim as a string — the
  // override is opaque content the author committed to and should not be
  // split. The default path renders structured content: a ✓ glyph (visual)
  // paired with an sr-only "Korrekt." prefix (AT) — see strings.da.ts for the
  // split keys. CLAUDE.md note about the leading `Korrekt.` doubling as the
  // AT announcement still holds; the sr-only span carries it.
  const lockedTooltipContent: ReactNode =
    lockedTooltip !== undefined ? (
      lockedTooltip
    ) : (
      <>
        <span aria-hidden="true">✓</span>
        <span className="sr-only">
          {strings.widgets.variableTable.lockedTooltipScreenReaderPrefix}
        </span>{' '}
        {strings.widgets.variableTable.lockedTooltipRest}
      </>
    );

  const ivMissing = missingMessagesFor(
    hintCtx,
    'iv',
    ivExpectedArr,
    errors?.iv,
    ivMissingMessage ?? strings.widgets.variableTable.hints.ivMissing,
  );
  const dvMissing = missingMessagesFor(
    hintCtx,
    'dv',
    dvExpectedArr,
    errors?.dv,
    dvMissingMessage ?? strings.widgets.variableTable.hints.dvMissing,
  );
  const constantsMissing = missingMessagesFor(
    hintCtx,
    'constants',
    constantsExpectedArr,
    errors?.constants,
    constantMissingMessage ?? strings.widgets.variableTable.hints.constantMissing,
  );

  const armed =
    expected !== undefined &&
    spendMode.kind === 'active' &&
    spendMode.phaseId === state.currentPhaseId;

  const onSpendCell = (section: Section, studentIndex: number, cell: Cell) => {
    const sectionExpected =
      section === 'iv' ? ivExpectedArr : section === 'dv' ? dvExpectedArr : constantsExpectedArr;
    const matches =
      section === 'iv' ? errors?.iv : section === 'dv' ? errors?.dv : errors?.constants;
    const spend = resolveSpend(hintCtx, section, sectionExpected, matches, studentIndex, cell);
    if (spend === null) return;
    spendAndRevealVtTier({
      widgetId: id,
      cellKey: spend.cellKey,
      revealedText: spend.revealedText,
      hintCap: spend.hintCap,
    });
    // With HintLightbulb removed, the click-to-spend lives on the input
    // itself; spend mode must exit here instead of inside the lightbulb.
    exitSpendMode();
  };

  // The lock key is resolved at render time via `lockKeyForStudent` and
  // snapshotted by `Field` at edit-session start, so this handler just
  // delegates to the store. Don't re-resolve from `errors` here — by the
  // time blur fires the matcher pairing may have shifted (multi-row best-
  // similarity pass), which would clear the wrong entry.
  const onUnlock = (lockKey: string) => {
    unlockVtCell(id, lockKey);
  };

  // Resolve the flash colour for a rendered cell. The flash is keyed by
  // expectedIndex, so map studentIndex → expectedIndex via the current matcher
  // (same pairing rule as `cellLockedForStudent`).
  function flashForStudent(
    section: 'iv' | 'dv' | 'constants',
    studentIndex: number,
    cell: Cell,
  ): 'correct' | 'wrong' | null {
    if (!flash) return null;
    const matches = errors?.[section];
    if (!matches) return null;
    const m = matches.find((x) => x.status !== 'missing' && x.studentIndex === studentIndex);
    if (!m || m.status === 'missing') return null;
    return flash.keys[cellKey(section, m.expectedIndex, cell)] ?? null;
  }

  return (
    <div className="my-4 w-fit max-w-full space-y-4">
      <div className="rounded-md border border-slate-200">
        {/* Single column-header band — desktop only; on mobile each input
            carries its own visible label (the stacked layout needs it). The
            slate-50 tint seats it as a header zone above the input sections.
            `rounded-t-md` clips the header band's slate-100 fill to match the
            wrapper's rounded corners — required because the wrapper drops
            `overflow-hidden` so HintPopup can escape downward. */}
        <div
          aria-hidden="true"
          className="hidden gap-3 rounded-t-md border-b border-slate-200 bg-slate-100 px-3 py-2 sm:grid sm:grid-cols-[minmax(10rem,16rem)_6rem_6rem_2rem]"
        >
          <div className="text-sm font-medium text-slate-600">{nameH}</div>
          <div className="text-sm font-medium text-slate-600">{symbolH}</div>
          <div className="text-sm font-medium text-slate-600">{unitH}</div>
        </div>
        <div className="divide-y divide-slate-100">
          <RowGroupSection
            sectionId="iv"
            idPrefix={`${id}-iv`}
            label={ivLabel ?? strings.widgets.variableTable.ivLabel}
            rows={values.iv}
            bounds={bounds.iv}
            nameHeader={nameH}
            symbolHeader={symbolH}
            unitHeader={unitH}
            addLabel={addIvLabel ?? strings.widgets.variableTable.addIvLabel}
            removeAriaLabel={removeIvAriaLabel ?? strings.widgets.variableTable.removeIvAriaLabel}
            rowAriaLabel={ivRowAriaLabel ?? strings.widgets.variableTable.ivRowAriaLabel}
            onChange={(idx, field, next) => updateRow('iv', idx, field, next)}
            onAdd={() => addRow('iv')}
            onRemove={(idx) => removeRow('iv', idx)}
            getInfo={(s, cell) => cellInfoFor(hintCtx, 'iv', ivExpectedArr, errors?.iv, s, cell)}
            getLocked={(s, cell) => cellLockedForStudent(locks, errors, 'iv', s, cell)}
            getLockKey={(s, cell) => lockKeyForStudent(locks, errors, 'iv', s, cell)}
            getFlash={(s, cell) => flashForStudent('iv', s, cell)}
            flashNonce={flash?.nonce ?? 0}
            flashWithTransition={flash?.withTransition ?? true}
            lockedTooltipContent={lockedTooltipContent}
            armedSpendableAriaDescription={resolvedArmedAria}
            missingMessages={ivMissing}
            emptyMessage={ivEmptyMessage}
            allowPaste={allowPaste}
            armed={armed}
            onSpend={(s, cell) => onSpendCell('iv', s, cell)}
            onUnlock={(lockKey) => onUnlock(lockKey)}
          />
          <RowGroupSection
            sectionId="dv"
            idPrefix={`${id}-dv`}
            label={dvLabel ?? strings.widgets.variableTable.dvLabel}
            rows={values.dv}
            bounds={bounds.dv}
            nameHeader={nameH}
            symbolHeader={symbolH}
            unitHeader={unitH}
            addLabel={addDvLabel ?? strings.widgets.variableTable.addDvLabel}
            removeAriaLabel={removeDvAriaLabel ?? strings.widgets.variableTable.removeDvAriaLabel}
            rowAriaLabel={dvRowAriaLabel ?? strings.widgets.variableTable.dvRowAriaLabel}
            onChange={(idx, field, next) => updateRow('dv', idx, field, next)}
            onAdd={() => addRow('dv')}
            onRemove={(idx) => removeRow('dv', idx)}
            getInfo={(s, cell) => cellInfoFor(hintCtx, 'dv', dvExpectedArr, errors?.dv, s, cell)}
            getLocked={(s, cell) => cellLockedForStudent(locks, errors, 'dv', s, cell)}
            getLockKey={(s, cell) => lockKeyForStudent(locks, errors, 'dv', s, cell)}
            getFlash={(s, cell) => flashForStudent('dv', s, cell)}
            flashNonce={flash?.nonce ?? 0}
            flashWithTransition={flash?.withTransition ?? true}
            lockedTooltipContent={lockedTooltipContent}
            armedSpendableAriaDescription={resolvedArmedAria}
            missingMessages={dvMissing}
            emptyMessage={dvEmptyMessage}
            allowPaste={allowPaste}
            armed={armed}
            onSpend={(s, cell) => onSpendCell('dv', s, cell)}
            onUnlock={(lockKey) => onUnlock(lockKey)}
          />
          <RowGroupSection
            sectionId="constants"
            idPrefix={`${id}-c`}
            label={constantsLabel ?? strings.widgets.variableTable.constantsLabel}
            rows={values.constants}
            bounds={bounds.constants}
            nameHeader={nameH}
            symbolHeader={symbolH}
            unitHeader={unitH}
            addLabel={addConstantLabel ?? strings.widgets.variableTable.addConstantLabel}
            removeAriaLabel={
              removeConstantAriaLabel ?? strings.widgets.variableTable.removeConstantAriaLabel
            }
            rowAriaLabel={
              constantRowAriaLabel ?? strings.widgets.variableTable.constantRowAriaLabel
            }
            onChange={(idx, field, next) => updateRow('constants', idx, field, next)}
            onAdd={() => addRow('constants')}
            onRemove={(idx) => removeRow('constants', idx)}
            getInfo={(s, cell) =>
              cellInfoFor(
                hintCtx,
                'constants',
                constantsExpectedArr ?? [],
                errors?.constants,
                s,
                cell,
              )
            }
            getLocked={(s, cell) => cellLockedForStudent(locks, errors, 'constants', s, cell)}
            getLockKey={(s, cell) => lockKeyForStudent(locks, errors, 'constants', s, cell)}
            getFlash={(s, cell) => flashForStudent('constants', s, cell)}
            flashNonce={flash?.nonce ?? 0}
            flashWithTransition={flash?.withTransition ?? true}
            lockedTooltipContent={lockedTooltipContent}
            armedSpendableAriaDescription={resolvedArmedAria}
            missingMessages={constantsMissing}
            emptyMessage={
              constantsEmptyMessage ?? strings.widgets.variableTable.constantsEmptyMessage
            }
            allowPaste={allowPaste}
            armed={armed}
            onSpend={(s, cell) => onSpendCell('constants', s, cell)}
            onUnlock={(lockKey) => onUnlock(lockKey)}
          />
        </div>
      </div>
      {expected && (!footerActive || showAriaStatus) && (
        <div className="mt-2 flex items-center justify-end gap-3">
          {showAriaStatus && (
            <output className="sr-only" aria-live="polite">
              {ariaStatusLabel}
            </output>
          )}
          {!footerActive && (
            <>
              <HintBucket placement="inline" />
              <InWidgetTjekButton
                onClick={handleTjek}
                label={checkLabel ?? strings.widgets.variableTable.checkLabel}
                dimReason={tjekDimReason}
                dimTooltip={tjekDimTooltip}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** In-widget Tjek button — dims when there's nothing to check (empty cells
 *  or no edits since the last Tjek). Never flashes: per F1, the only
 *  emerald-flash signal lives on the footer button at the moment the phase
 *  gate transitions to satisfied. */
function InWidgetTjekButton({
  onClick,
  label,
  dimReason,
  dimTooltip,
}: {
  onClick: () => void;
  label: string;
  dimReason: TjekDimReason;
  dimTooltip: string | undefined;
}) {
  const dimmed = dimReason !== null;
  const baseClass = 'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors';
  const stateClass = dimmed
    ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
    : 'bg-white border-accent-400 text-slate-700 hover:bg-accent-50';

  const button = (
    <button
      type="button"
      onClick={() => {
        if (dimmed) return;
        onClick();
      }}
      disabled={dimmed && dimTooltip == null}
      aria-disabled={dimTooltip != null || undefined}
      className={`${baseClass} ${stateClass}`}
    >
      {label}
    </button>
  );

  if (dimmed && dimTooltip != null) {
    return (
      <Tooltip content={dimTooltip} align="right" openDelayMs={500}>
        {button}
      </Tooltip>
    );
  }
  return button;
}
