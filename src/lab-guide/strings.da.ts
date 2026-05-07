// Hard-coded Danish UI strings. Future translation = swap this file.
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
    switchInquiryForm: '← Skift undersøgelsesform',
    hideSimulation: 'Skjul simulation',
    showSimulation: 'Vis simulation',
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
  errors: {
    notFound: 'Forsøget blev ikke fundet.',
  },
} as const;
