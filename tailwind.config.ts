import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        pharmacy: {
          bg: "#f5f7fb",
          deep: "#020817",
          primary: "#06b6d4",      // cyan-ish
          primaryDark: "#0e7490",
          accent: "#10b981",
          accentSoft: "#d1fae5"
        }
      },
      boxShadow: {
        "soft-card": "0 18px 45px rgba(15, 23, 42, 0.16)"
      },
      borderRadius: {
        "4xl": "2rem"
      }
    }
  },
  plugins: []
};

export default config;
