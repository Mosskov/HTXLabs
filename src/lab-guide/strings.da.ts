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
