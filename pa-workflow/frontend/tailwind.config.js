/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          900: '#0F1F3D',
          800: '#1F3864',
          700: '#2E5FA3',
          500: '#4A7FCC',
          100: '#D6E4F7',
        },
        success: {
          700: '#1B4D2E',
          500: '#2D7D4F',
          100: '#D1FAE5',
        },
        warning: {
          700: '#92400E',
          500: '#C55A11',
          100: '#FEF3C7',
        },
        danger: {
          700: '#7B0000',
          500: '#DC2626',
          100: '#FEE2E2',
        },
        neutral: {
          900: '#0F172A',
          700: '#334155',
          500: '#64748B',
          200: '#E2E8F0',
          100: '#F1F5F9',
          50:  '#F8FAFC',
        },
        white: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
      },
      borderRadius: {
        xl: '12px',
        lg: '8px',
        full: '9999px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
        elevated: '0 4px 24px rgba(0,0,0,0.12)',
        'focus-ring': '0 0 0 3px rgba(46,95,163,0.25)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
