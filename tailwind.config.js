/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#ecfdf3', 100: '#d1fadf', 500: '#12805c', 600: '#0b6b4c', 700: '#08533b', 900: '#04291d' },
        avail: '#22c55e',
        booked: '#f59e0b',
        sold: '#ef4444',
      },
    },
  },
  plugins: [],
};
