/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: { xs: '420px' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#b8d5ff',
          300: '#89b6ff',
          400: '#588dff',
          500: '#2f66ff',
          600: '#1f4be0',
          700: '#1a3cb3',
          800: '#1a3390',
          900: '#1b2f72',
        },
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
    },
  },
  plugins: [],
};
