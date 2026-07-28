/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        // Factor42 brand tokens (from styles.css / inline usage)
        brand: {
          blue: '#0066FF',
          'blue-dark': '#0052CC',
          cyan: '#00B4D8',
          ink: '#0A0F1E',
          bg: '#F0F4FF',
        },
      },
    },
  },
  plugins: [],
};
