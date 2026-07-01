import type { Config } from 'tailwindcss';
import { colors, fonts, spacing } from './src/theme/tokens';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      spacing,
      fontFamily: {
        display: [fonts.display, 'sans-serif'],
        body: [fonts.body, 'sans-serif'],
        mono: [fonts.mono, 'monospace'],
      },
      borderRadius: {
        none: '0px',
      },
    },
  },
  plugins: [],
} satisfies Config;
