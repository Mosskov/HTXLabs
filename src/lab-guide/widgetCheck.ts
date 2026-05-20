// Footer-check registry type: a widget's check action the PhaseFooter can invoke.
/** A check action a `checkInFooter` widget registers against its id so the
 *  PhaseFooter can drive the widget's Tjek from the merged footer button.
 *  Kept out of the pure `gates.ts` `WidgetState` — a React callback plus live
 *  `disabled`/`pending` booleans do not belong in the gate-evaluation payload. */
export interface WidgetCheck {
  /** Footer button label for this step (e.g. "Tjek variable" / "Tjekker…"). */
  label: string;
  /** The widget's check — VariableTable.handleTjek (sync) or
   *  RubricResponse.evaluate (async). */
  run: () => void | Promise<void>;
  /** Footer button is disabled while this is true (e.g. below min-words). */
  disabled: boolean;
  /** True while an async check is in flight — the footer shows the pending label. */
  pending: boolean;
  /** Why the check is disabled, when the disable warrants an explanation (e.g.
   *  below the min-words floor). The PhaseFooter surfaces it as a hover tooltip
   *  on the footer button. Omitted when no explanation is needed (empty input,
   *  check in flight). */
  disabledReason?: string;
}
