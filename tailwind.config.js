/** @type {import('tailwindcss').Config} */
export default {
  // The iframe document isolates styles, so preflight is safe to keep on
  // and no prefix/important scoping is needed.
  content: ["./src/**/*.{ts,tsx}"],
  // The panel document carries the theme flag for Tailwind's dark variant.
  darkMode: ["selector", '[data-zc-theme="dark"]'],
  theme: {
    extend: {
      // Notion-ish restraint: small radii, tight scale.
      borderRadius: { DEFAULT: "3px", sm: "2px", md: "4px", lg: "6px" },
      fontSize: {
        xs: ["0.7857rem", { lineHeight: "1.45" }],
        sm: ["0.8571rem", { lineHeight: "1.5" }],
        base: ["1rem", { lineHeight: "1.5" }],
        lg: ["1.071rem", { lineHeight: "1.47" }],
      },
      transitionDuration: { DEFAULT: "120ms" },
      colors: {
        // Mapped onto Zotero's own CSS variables so the panel follows the
        // host theme through the explicit bridge into the iframe document.
        surface: "var(--zc-surface)",
        "surface-subtle": "var(--zc-surface-subtle)",
        "surface-hover": "var(--zc-surface-hover)",
        "surface-raised": "var(--zc-surface-raised)",
        border: "var(--zc-border)",
        fg: "var(--zc-fg)",
        "fg-muted": "var(--zc-fg-muted)",
        "fg-faint": "var(--zc-fg-faint)",
        accent: "var(--zc-accent)",
        "accent-fg": "var(--zc-accent-fg)",
        danger: "var(--zc-danger)",
      },
    },
  },
  plugins: [],
};
