/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4f46e5', // Indigo 600
        secondary: '#ec4899', // Pink 500
        paper: '#f9fafb',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Noto Serif SC', 'serif'], // Good for A4 paper feel
        kai: ['KaiTi', 'STKaiti', 'serif'], // Standard Chinese educational font
      }
    }
  },
  plugins: [],
}

