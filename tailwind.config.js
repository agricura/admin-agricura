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
          primary: '#7E1222',   // Agricura Burgundy Red
          secondary: '#0D272F', // Agricura Deep Blue-Green
          accent: '#E0C56E',    // Agricura Soft Gold
        }
      }
    },
  },
  plugins: [],
}