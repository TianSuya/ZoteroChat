/** @type {import('tailwindcss').Config} */
export default {
  // Shadow DOM isolates us completely, so preflight is safe to keep on
  // and no prefix/important scoping is needed.
  content: ["./src/**/*.{ts,tsx}"],
  // The flag sits on `.zc-root` / `.zc-portal`, inside the shadow tree —
  // Tailwind's variant needs an ancestor it can actually match.
  darkMode: ["selector", '[data-zc-theme="dark"]'],
  theme: {
    extend: {
      // Notion-ish restraint: small radii, tight scale.
      borderRadius: { DEFAULT: "3px", sm: "2px", md: "4px", lg: "6px" },
      fontSize: {
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["12px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "21px" }],
        lg: ["15px", { lineHeight: "22px" }],
      },
      transitionDuration: { DEFAULT: "120ms" },
      colors: {
        // Mapped onto Zotero's own CSS variables so the panel follows the
        // host theme automatically. Custom properties inherit through the
        // shadow boundary, so no bridging code is required.
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
