import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#f7f7f2",
        foreground: "#1f2a2e",
        primary: "#0f766e",
        muted: "#e8ede8"
      }
    }
  },
  plugins: []
};

export default config;
