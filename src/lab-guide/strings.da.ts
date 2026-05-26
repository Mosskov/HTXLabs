// Hard-coded Danish UI strings. Future translation = swap this file.
//
// Templates use {placeholder} syntax — substitute with `format()`. Keep them
// literal (no backtick interpolation) so the registry stays a flat scannable
// map. Per-instance overrides live as widget props (e.g. FreeTextResponse's
// `placeholder` / `tooShortMessage`); the entries here are framework defaults.
export const strings = {
  brand: 'HTX Labs',
  /** Small uppercase label rendered above the page title on lab + simulation pages. */
  eyebrow: {
    lab: 'LAB',
    simulation: 'SIMULATION',
  },
  nav: {
    home: 'Forsiden',
    topics: 'Emner',
    /** Back-link from a topic page to the home/landing page. */
    backToHome: '← Forsiden',
    /** Back-link from a lab page to its parent topic. Var: {topic} */
    backToTopic: '← {topic}',
  },
  home: {
    intro: 'Interaktive fysikforsøg til HTX-elever. Vælg et emne for at komme i gang.',
    /** "Forsøg" is uncountable in Danish — same form for 1 and N. Vars: {n} */
    experimentCount: '{n} forsøg',
    testSimsCard: {
      title: 'Simulationer',
      subtitle: 'Afprøv simulationer uden en lab-side.',
      /** Vars: {n} = sim count. "Simulationer" same form for 1 and N. */
      count: '{n} simulationer',
    },
  },
  guide: {
    heading: 'Laboratorieguide',
    nextPhase: 'Næste fase →',
    previousPhase: '← Forrige fase',
    resetWork: 'Nulstil lab',
    resetWorkConfirmTitle: 'Nulstil lab?',
    resetWorkConfirmBody:
      'Er du sikker på, at du vil slette alt dit arbejde i dette lab?\nDette kan ikke fortrydes.',
    resetWorkConfirmCancel: 'Annuller',
    resetWorkConfirmAction: 'Nulstil',
    finishGuide: 'Afslut guide',
    guideFinished: 'Forsøg afsluttet — godt arbejde!',
    switchInquiryForm: '← Skift undersøgelsesform',
    theoryLabel: 'Formål og teori',
    simulationLabel: 'Simulation',
  },
  phaseStepper: {
    /** Vars: {n} = 1-based phase number, {title} = phase title, {current} = currentSuffix or '' */
    phaseAriaLabel: 'Fase {n}: {title}{current}',
    currentSuffix: ' (nuværende)',
  },
  /** Instruction-box checklist (the light-blue card above the phase body).
   *  Sr-only suffixes appended to a tracked step's text so assistive tech
   *  hears its completion state — the circle + ✓ are decorative. An `active`
   *  step gets no suffix (the default state). */
  instructionBox: {
    stepDone: ' (fuldført)',
    stepLocked: ' (låst)',
    /** Generic tooltip on a locked tracker step — overridden per step by the
     *  author-supplied `lockedHint` field on a `PhaseStep` (SPEC §17). */
    stepLockedHint: 'Dette trin låses op, når du har fuldført trinnene ovenfor.',
  },
  modes: {
    guided: 'Guidet',
    'semi-guided': 'Semi-guidet',
    open: 'Åben',
  },
  /** Lab landing page (mode picker). */
  landing: {
    heading: 'Vælg undersøgelsesform',
    /** Vars: {minutes} */
    durationChip: '~{minutes} min',
    levelChip: {
      'c-level': 'C-niveau',
      'b-level': 'B-niveau',
      'a-level': 'A-niveau',
    },
    modeCards: {
      guided: {
        title: 'Guidet',
        description: 'Trin-for-trin vejledning og instruktioner ved hver fase.',
      },
      'semi-guided': {
        title: 'Semi-guidet',
        description: 'Korte overblik med hints, som du kan åbne efter behov.',
      },
      open: {
        title: 'Åben undersøgelse',
        description: 'Kun værktøjerne – du bestemmer selv fremgangsmåden.',
      },
    },
    continueLabel: 'Fortsæt',
    startLabel: 'Start',
    unavailableHint: 'Ikke tilgængelig for dette forsøg',
    /** Confirm when switching to a different mode while saved progress exists
     * in the current one. Vars: {current} = saved mode name, {next} = clicked mode name. */
    confirmModeSwitch:
      'Du har gemt fremgang i {current}. Hvis du starter {next}, nulstilles fremgangen. Vil du fortsætte?',
  },
  labModes: {
    virtual: 'Virtuel',
    real: 'Real lab',
  },
  paste: {
    blocked: 'Indsæt er deaktiveret — skriv selv dit svar.',
  },
  widgets: {
    hints: {
      /** Aria label on the bucket button when spend mode is idle. Vars:
       *  {tokens} = current count, {pool} = cap. */
      bucketAriaLabel: 'Hint-pulje: {tokens} af {pool} hints tilbage',
      /** Aria label on the bucket button while spend mode is armed — tells
       *  the student what to do next. */
      bucketSpendModeAriaLabel:
        'Vælg hvor du vil bruge et hint, eller tryk Escape for at annullere',
      /** Tooltip shown on a click against an empty bucket (no countdown). */
      bucketEmpty: 'Hint-puljen er tom',
      /** Tooltip / status when the bucket is empty but a refill is coming.
       *  Vars: {time} = formatted M:SS. */
      bucketCountdown: 'Næste hint om {time}',
      /** Tooltip when the phase carries `hintPoolSize: 0`. */
      bucketDisabled: 'Hints er ikke tilgængelige i denne fase',
      /** Tooltip when the bucket has tokens but no spendable target remains in
       *  the phase — every failing cell/criterion has exhausted its ladder, or
       *  every target is already satisfied. */
      bucketNoTargets: 'Ingen steder at bruge hint i denne fase',
      /** Aria label on a per-field lightbulb. Vars: {tier} = next-tier digit,
       *  {cap} = ladder length. */
      lightbulbAriaLabel: 'Få et hint ({tier} af {cap})',
      /** Visible label on the reveal pill — the 4th-tier "show the answer"
       *  affordance. Vars: {cost} = token cost (always 2 today). */
      revealLabel: 'Vis svar ({cost})',
      revealAriaLabel: 'Brug {cost} hints for at se svaret',
      /** Aria label on the popup container that opens on focus. */
      popupAriaLabel: 'Tilgængelige hints',
      /** Tooltip on a disabled reveal pill (bucket below cost). */
      insufficientHints: 'Du har ikke nok hints.',
      /** Sr-only description on an armed-spendable VariableTable cell — the
       *  whole input rectangle becomes the spend target, so AT users need to
       *  be told the cell is clickable + Enter-activated. */
      armedSpendableAriaDescription: 'Klik eller tryk Enter for at bruge et hint på dette felt.',
    },
    freeText: {
      placeholder: 'Skriv dit svar her...',
      /** Vars: {n} = minWords threshold */
      tooShort: 'Skriv mindst {n} ord for et fyldestgørende svar.',
      /** Vars: {n} = matched groups, {t} = total groups */
      keywordsFound: 'Nøgleord fundet: {n} / {t}',
    },
    quiz: {
      checkLabel: 'Tjek',
      correct: 'Korrekt!',
      incorrect: 'Forkert — prøv igen.',
    },
    resetButton: {
      label: 'Nulstil eksperiment',
      confirm: 'Nulstil dette eksperiment? Dine besvarelser i denne lab slettes.',
    },
    dataTable: {
      caption: 'Målinger:',
      addRow: '+ Tilføj række',
      deleteRowAriaLabel: 'Slet række',
      /** Sim-mode footer text. Vars: {n} = count of recorded measurements. */
      simModeCaption: '{n} målinger registreret af simulationen.',
      /** Sim-mode footer text when no measurements have been recorded yet. */
      simEmpty: 'Ingen målinger endnu — registrér målinger i simulationen.',
    },
    rubric: {
      placeholder: 'Skriv dit svar her...',
      checkLabel: 'Tjek mit svar',
      evaluating: 'Tjekker…',
      /** Vars: {n} = minWords threshold */
      tooShort: 'Skriv mindst {n} ord før du tjekker.',
      /** Vars: {n} = maxWords threshold */
      tooLong: 'Skriv højst {n} ord før du tjekker.',
      /** Vars: {n} = current word count, {max} = maxWords threshold */
      wordCount: '{n} / {max} ord',
      embedderDown:
        'Den semantiske vurdering er ikke tilgængelig lige nu — start embed-serveren og prøv igen.',
      statusPassed: 'Godkendt',
      rubricError: 'Denne opgave er midlertidigt utilgængelig.',
      hintsLabel: 'Tips til de manglende krav',
    },
    variableTable: {
      ivLabel: 'Uafhængig variabel',
      dvLabel: 'Afhængig variabel',
      constantsLabel: 'Konstanter',
      nameHeader: 'Fysisk størrelse',
      symbolHeader: 'Symbol',
      unitHeader: 'Enhed',
      addConstantLabel: '+ Tilføj konstant',
      addIvLabel: '+ Tilføj uafhængig variabel',
      addDvLabel: '+ Tilføj afhængig variabel',
      /** Empty-state copy shown inside the Konstanter section when it has zero
       *  rows. Author-overridable per instance via the widget's
       *  `constantsEmptyMessage` prop. */
      constantsEmptyMessage: 'Ingen konstanter tilføjet endnu.',
      /** Aria labels for the per-row remove (×) button. Vars: {n} = 1-based row
       *  index, so screen readers can distinguish which row a button removes. */
      removeConstantAriaLabel: 'Fjern konstant {n}',
      removeIvAriaLabel: 'Fjern uafhængig variabel {n}',
      removeDvAriaLabel: 'Fjern afhængig variabel {n}',
      /** Repeated-row aria labels. Vars: {n} = 1-based row index, {field} =
       *  nameHeader/symbolHeader/unitHeader. */
      constantRowAriaLabel: 'Konstant {n}, {field}',
      ivRowAriaLabel: 'Uafhængig variabel {n}, {field}',
      dvRowAriaLabel: 'Afhængig variabel {n}, {field}',
      checkLabel: 'Tjek mine variable',
      /** Tooltip on the Tjek button when no values have been entered yet (so a
       *  click would produce a uniformly empty/wrong result). */
      tjekDisabledEmpty: 'Indtast mindst én værdi for at tjekke',
      /** Tooltip on the Tjek button when the values are unchanged since the
       *  last Tjek (re-clicking would yield an identical result). */
      tjekDisabledClean: 'Ingen ændringer siden sidste tjek',
      /** Tooltip on a locked cell (hover + focus) — full string form.
       *  Used as the fallback when an author passes a `lockedTooltip` prop
       *  override (which keeps the verbal "Korrekt." prefix verbatim). The
       *  default-rendering path splits this into the two keys below so
       *  sighted users see a checkmark glyph and AT users still hear
       *  "Korrekt." via an sr-only span. */
      lockedTooltip: 'Korrekt. Dobbeltklik for at åbne',
      /** Sr-only prefix carrying the AT announcement when the default
       *  structured tooltip is rendered (✓ visually + "Korrekt." for AT). */
      lockedTooltipScreenReaderPrefix: 'Korrekt.',
      /** Visible imperative paired with the ✓ glyph in the default tooltip. */
      lockedTooltipRest: 'Dobbeltklik for at åbne',
      /** Sr-only live-region announcement fired the moment a passing Tjek
       *  hides the visible status pill, so assistive-tech users still hear
       *  that the table was accepted. Reuses the existing `status.checked`
       *  copy verbatim — no new Danish phrasing introduced. */
      checkedAriaStatusLabel: 'Godkendt',
      /** Per-cell tiered hint ladders keyed by `CellError.type` values. Each
       *  entry is a `string[]` — index `0` is tier 1, index `1` is tier 2, …
       *  The renderer indexes by `Math.min(tier - 1, ladder.length - 1)`,
       *  clamping at the last entry. Author-supplied per-cell `hints` and
       *  `commonMistake.hint` extend / replace tiers — see
       *  variableTableCorrectness.ts `resolveLadder`. Tier-3 entries are
       *  reserved for author overrides; the generic ladder stops at tier 2
       *  to avoid handing students the answer. */
      hints: {
        name: {
          // No hint — an empty input already says it is empty.
          empty: [],
          mismatch: [
            'Tjek navnet på den fysiske størrelse.',
            'Brug navnet teorien introducerer — ikke et generelt ord som "ting" eller "variabel".',
          ],
          misplaced: [
            'Dette navn passer til et andet felt i samme række.',
            'Tjek om du har byttet om på Navn og Symbol (eller Enhed).',
          ],
          'row-swapped': [
            'Dette navn hører til den anden variabel.',
            'Tjek om du har byttet om på den uafhængige og afhængige variabel.',
          ],
          'whitespace-internal': [
            'Navnet er korrekt, men der er et ekstra mellemrum indeni.',
            'Fjern mellemrummet inde i navnet.',
          ],
        },
        symbol: {
          // No hint — an empty input already says it is empty.
          empty: [],
          mismatch: [
            'Tjek dit symbol.',
            'Brug det symbol teorien introducerer for denne størrelse.',
          ],
          'case-mismatch': [
            'Tjek dette symbol — er stort/lille bogstav rigtigt?',
            'Brug samme store/små bogstav som i teorien.',
          ],
          misplaced: [
            'Dette symbol passer til et andet felt i samme række.',
            'Tjek om du har byttet om på Symbol og Enhed (eller Navn).',
          ],
          'row-swapped': [
            'Dette symbol hører til den anden variabel.',
            'Tjek om du har byttet om på den uafhængige og afhængige variabel.',
          ],
          'whitespace-internal': [
            'Symbolet er korrekt, men der er et ekstra mellemrum indeni.',
            'Fjern mellemrummet inde i symbolet.',
          ],
        },
        unit: {
          // No hint — an empty input already says it is empty.
          empty: [],
          mismatch: ['Tjek enheden.', 'Brug SI-enheden teorien introducerer for denne størrelse.'],
          'case-mismatch': [
            'Tjek enheden — er stort/lille bogstav rigtigt?',
            'SI-symboler afledt af personnavne starter med stort (N, Pa, J); grundenheder med lille (m, s, kg).',
          ],
          misplaced: [
            'Denne enhed passer til et andet felt i samme række.',
            'Tjek om du har byttet om på Enhed og Symbol (eller Navn).',
          ],
          'row-swapped': [
            'Denne enhed hører til den anden variabel.',
            'Tjek om du har byttet om på den uafhængige og afhængige variabel.',
          ],
          'whitespace-internal': [
            'Enheden er korrekt, men der er et ekstra mellemrum indeni.',
            'Fjern mellemrummet inde i enheden.',
          ],
        },
        /** Vars: {name}, {symbol}, {unit} — renderer pre-resolves to the
         *  first synonym from each expected.constants[i] accepted-array via
         *  asArray(...)[0]. */
        constantMissing: 'Du mangler en konstant: {name} ({symbol}, {unit}).',
        /** Variants of constantMissing for IV/DV sections, surfaced when a
         *  section's expected entry has no matching student row. */
        ivMissing: 'Du mangler en uafhængig variabel: {name} ({symbol}, {unit}).',
        dvMissing: 'Du mangler en afhængig variabel: {name} ({symbol}, {unit}).',
      },
    },
  },
  gates: {
    milestone: 'Du skal gennemføre forsøget mindst én gang for at fortsætte.',
    /** Vars: {min} */
    dataPoints: 'Indsamle mindst {min} gyldige målinger før næste fase.',
    allCorrect: "Klik 'Tjek' og opnå alle korrekte svar.",
    allChecked: 'Sæt flueben ved alle punkter på tjeklisten.',
    allFilled: 'Besvar alle spørgsmål for at fortsætte.',
    /** Vars: {min} */
    keywordCount: 'Find mindst {min} nøgleord.',
    keywordCountAll: 'Brug nøgleord fra alle krav for at fortsætte.',
    predicate: 'Forsøget skal opfylde et bestemt kriterium for at fortsætte.',
    rubricRequired: 'Skriv et svar og tryk Tjek mit svar — alle krav skal være opfyldt.',
    allSatisfied: 'Fuldfør alle delopgaver for at fortsætte.',
    allValidated: 'Udfyld alle felter korrekt for at fortsætte.',
  },
  errors: {
    notFound: 'Forsøget blev ikke fundet.',
    labInvalidTitle: 'Forsøget kunne ikke indlæses',
    labInvalidHelp: 'Ret frontmatter i forsøgets index.ts og genindlæs siden.',
  },
  /** Standalone sim playground chrome (routes/simulationer.tsx). */
  simulationer: {
    title: 'Simulationer',
    indexIntro: 'Vælg en simulation for at afprøve den uden en lab-side.',
    noSimulations: 'Ingen simulationer registreret.',
    loading: 'Indlæser…',
    /** Vars: {id} = sim id from URL */
    unknownSim: 'Ukendt simulation: {id}',
    measuringSize: 'Måler størrelse…',
    /** Vars: {title} = sim display title */
    titleWithSim: 'Simulation: {title}',
    params: 'Parametre',
    pause: 'Pause',
    reset: 'Reset',
    /** Vars: {n} = event count */
    eventLog: 'Event log ({n})',
    clearLog: 'Clear log',
    noEvents: 'Ingen events endnu.',
  },
} as const;

/** Substitute {name} placeholders. Unknown keys render as the literal `{name}`. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
