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
          DEFAULT: '#1F3864',
          dark: '#152747',
          light: '#2A4A7A',
        },
        secondary: {
          DEFAULT: '#2E5FA3',
          dark: '#244B82',
          light: '#4573B8',
        },
        success: {
          DEFAULT: '#375623',
          light: '#4A702F',
          dark: '#284219',
        },
        warning: {
          DEFAULT: '#C55A11',
          light: '#D9742F',
          dark: '#9A480D',
        },
        danger: {
          DEFAULT: '#7B0000',
          light: '#A30000',
          dark: '#520000',
        },
        background: {
          DEFAULT: '#F5F7FA',
          dark: '#E8EBF0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
