/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        okx: {
          black: '#000000',
          bg: '#080808',
          card: '#121212',
          cardHover: '#181818',
          cardSub: '#1a1a1a',
          border: '#222222',
          borderLight: '#2e2e2e',
          lime: '#c8ff00',
          limeHover: '#b5e600',
          muted: '#767676',
          subtext: '#999999',
        },
        brand: {
          50: '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#bef264',
          400: '#a3e635',
          500: '#c8ff00', // OKX neon lime
          600: '#84cc16',
          700: '#65a30d',
          800: '#4d7c0f',
          900: '#3f6212',
          950: '#1a2e05',
        },
        dark: {
          bg: '#000000',
          card: '#121212',
          border: '#222222',
          muted: '#2a2a2a',
        }
      },
    },
  },
  plugins: [],
}
