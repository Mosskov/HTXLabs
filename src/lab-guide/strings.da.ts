// Hard-coded Danish UI strings. Future translation = swap this file.
//
// Templates use {placeholder} syntax — substitute with `format()`. Keep them
// literal (no backtick interpolation) so the registry stays a flat scannable
// map. Per-instance overrides live as widget props (e.g. FreeTextResponse's
// `placeholder` / `tooShortMessage`); the entries here are framework defaults.
export const strings = {
  brand: 'HTX Labs',
  nav: {
    home: 'Forsiden',
    topics: 'Emner',
  },
  guide: {
    heading: 'Laboratorieguide',
    nextPhase: 'Næste fase →',
    previousPhase: '← Forrige fase',
    finishGuide: 'Afslut guide',
    guideFinished: 'Forsøg afsluttet — godt arbejde!',
    switchInquiryForm: '← Skift undersøgelsesform',
    hideSimulation: 'Skjul simulation',
    showSimulation: 'Vis simulation',
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
} as const;

/** Substitute {name} placeholders. Unknown keys render as the literal `{name}`. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
