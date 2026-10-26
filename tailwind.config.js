/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ide: {
          bg: '#0d1117',
          surface: '#161b22',
          sidebar: '#0e1116',
          border: '#30363d',
          accent: '#58a6ff',
          hover: '#21262d',
          active: '#1f242c',
          text: '#c9d1d9',
          muted: '#8b949e',
          success: '#3fb950',
          warning: '#d29922',
          danger: '#f85149'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
