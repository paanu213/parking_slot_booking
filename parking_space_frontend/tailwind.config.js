/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../packages/ui/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: { xs: '420px' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      colors: {
        // Brand colour comes from CSS variables (src/styles/index.css) so a page can
        // re-theme it — QR pages switch it to green via the `theme-qr` class.
        brand: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, `rgb(var(--brand-${n}) / <alpha-value>)`]),
        ),
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
      keyframes: {
        'pop-in': {
          '0%':   { transform: 'scale(0.4)', opacity: '0' },
          '65%':  { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        'draw-check': {
          '0%':   { strokeDashoffset: '48' },
          '100%': { strokeDashoffset: '0' },
        },
        'ring-pulse': {
          '0%':   { transform: 'scale(0.85)', opacity: '0.55' },
          '100%': { transform: 'scale(1.7)', opacity: '0' },
        },
        'confetti-fall': {
          '0%':   { transform: 'translateY(-16px) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(160px) rotate(360deg)', opacity: '0' },
        },
        'fade-up': {
          '0%':   { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'pop-in':       'pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        'draw-check':   'draw-check 0.5s 0.35s ease-out both',
        'ring-pulse':   'ring-pulse 1.8s ease-out infinite',
        'confetti-fall': 'confetti-fall 1.9s ease-in forwards',
        'fade-up':      'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
