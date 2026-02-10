/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Le noir profond des écrans OLED
        cyber: {
          black: "#050505",
          dark: "#0a0a0a",
          panel: "#0f1115",
          dim: "rgba(0, 243, 255, 0.05)", // Pour les fonds subtils
        },
        // Les couleurs Néons
        neon: {
          blue: "#00f3ff",    // Cyan TITAN
          green: "#00ff41",   // Matrix Green
          orange: "#ff9e00",  // Warning Orange
          red: "#ff003c",     // Cyberpunk Red
          purple: "#bc13fe",
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'], // Tout sera en mono
        sans: ['"JetBrains Mono"', 'monospace'], // On force le mono partout
      },
      boxShadow: {
        'glow-blue': '0 0 10px rgba(0, 243, 255, 0.3), 0 0 20px rgba(0, 243, 255, 0.1)',
        'glow-green': '0 0 10px rgba(0, 255, 65, 0.3)',
        'glow-red': '0 0 10px rgba(255, 0, 60, 0.3)',
      },
      animation: {
        'blink': 'blink 1s step-end infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        }
      }
    },
  },
  plugins: [],
}