/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#FF2D9B',
          pinkDark: '#D81B7A',
          pinkLight: '#FF7AB8',
          gold: '#FBBF24',
          darkBg: '#1b0a26',
          cardBg: '#261236',
          border: 'rgba(255, 45, 155, 0.25)'
        }
      },
      fontFamily: {
        dangrek: ['Dangrek', 'cursive'],
        khmer: ['Noto Sans Khmer', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

