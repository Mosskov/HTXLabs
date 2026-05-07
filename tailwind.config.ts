import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Single accent — saturated blue close to htxlabs.dk
        accent: {
          DEFAULT: '#2563eb',
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Navy headings
        navy: '#0f172a',
        // Light-blue instruction-box background
        'instruction-bg': '#eff6ff',
        // Lavender callout for KeyEquation
        callout: {
          bg: '#eef2ff',
          border: '#c7d2fe',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'serif'],
      },
      maxWidth: {
        prose: '70ch',
        lab: '960px',
      },
    },
  },
  plugins: [],
} satisfies Config;
