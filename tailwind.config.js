/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#0F0128',
        deep: '#2A0B4F',
        robe: '#5B21B6',
        cyan: '#3FF0FF',
        moss: '#6BBF3A',
        gold: '#F5B83D',
        parchment: '#F3DDB0',
        ink: '#2B1A10',
        cream: '#FBF4E6',
      },
      fontFamily: {
        pixel: ['"Pixelify Sans"', 'system-ui', 'sans-serif'],
        body: ['-apple-system', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
