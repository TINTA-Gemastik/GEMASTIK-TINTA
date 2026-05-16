import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy Next.js
        background: "var(--background)",
        foreground: "var(--foreground)",
        // TINTA palette
        "tinta-light":        "#FFFFFF",
        "tinta-warm":         "#B9B6AD",
        "tinta-blue":         "#AABED6",
        "tinta-main":         "#2D4E71",
        "tinta-dark":         "#111111",
        // TINTA semantic
        "tinta-accent":       "#2D4E71",
        "tinta-accent-light": "#AABED6",
        "tinta-accent-hover": "#213a56",
        "tinta-border":       "#B9B6AD",
        "tinta-danger":       "#c0392b",
        "tinta-warning":      "#e67e22",
        "tinta-ok":           "#2D4E71",
      },
      fontFamily: {
        geist:    ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        "geist-mono": ["var(--font-geist-mono)", "monospace"],
      },
      borderColor: {
        DEFAULT: "#B9B6AD",
      },
      animation: {
        "slide-in-up": "slideInUp 0.2s ease-out both",
        "fade-in":     "fadeIn 0.15s ease-out both",
      },
      keyframes: {
        slideInUp: {
          from: { opacity: "0", transform: "translateY(0.5rem)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
