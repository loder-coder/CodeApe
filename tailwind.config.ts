import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        editor: {
          bg: "#1e1e1e",
          panel: "#252526",
          rail: "#333333",
          border: "#3c3c3c",
          tab: "#2d2d2d",
          active: "#1e1e1e",
          text: "#d4d4d4",
          muted: "#858585",
          blue: "#007acc",
          green: "#6a9955",
          yellow: "#dcdcaa",
          orange: "#ce9178",
          purple: "#c586c0",
          red: "#f44747"
        }
      },
      fontFamily: {
        mono: ["Consolas", "Cascadia Code", "Menlo", "Monaco", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
