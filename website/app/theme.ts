import { createTheme } from "remix/ui/theme";

// Brand colours: deep navy + sky-blue accent on crisp white.
export const AppTheme = createTheme({
  space: {
    none: "0px",
    px: "1px",
    xs: "2px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    xxl: "24px",
  },
  radius: {
    none: "0px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },
  fontFamily: {
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  },
  fontSize: {
    xxxs: "10px",
    xxs: "11px",
    xs: "12px",
    sm: "14px",
    md: "16px",
    lg: "18px",
    xl: "20px",
    xxl: "28px",
  },
  lineHeight: {
    tight: "1.2",
    normal: "1.5",
    relaxed: "1.7",
  },
  letterSpacing: {
    tight: "-0.025em",
    normal: "0em",
    meta: "0.06em",
    wide: "0.1em",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  control: {
    height: {
      sm: "28px",
      md: "36px",
      lg: "44px",
    },
  },
  surface: {
    lvl0: "#ffffff",
    lvl1: "#f8fafc",
    lvl2: "#f1f5f9",
    lvl3: "#e2e8f0",
    lvl4: "#cbd5e1",
  },
  shadow: {
    xs: "0 1px 2px rgb(0 0 0 / 0.05)",
    sm: "0 1px 3px rgb(0 0 0 / 0.10)",
    md: "0 4px 10px rgb(0 0 0 / 0.12)",
    lg: "0 10px 30px rgb(0 0 0 / 0.16)",
    xl: "0 20px 50px rgb(0 0 0 / 0.20)",
  },
  colors: {
    text: {
      primary: "#0f172a",
      secondary: "#334155",
      muted: "#64748b",
      link: "#0ea5e9",
    },
    border: {
      subtle: "#e2e8f0",
      default: "#cbd5e1",
      strong: "#94a3b8",
    },
    focus: {
      ring: "#0ea5e9",
    },
    overlay: {
      scrim: "rgb(0 0 0 / 0.5)",
    },
    action: {
      primary: {
        background: "#0f172a",
        backgroundHover: "#1e293b",
        backgroundActive: "#334155",
        foreground: "#ffffff",
        border: "#0f172a",
      },
      secondary: {
        background: "#ffffff",
        backgroundHover: "#f8fafc",
        backgroundActive: "#f1f5f9",
        foreground: "#0f172a",
        border: "#cbd5e1",
      },
      danger: {
        background: "#dc2626",
        backgroundHover: "#b91c1c",
        backgroundActive: "#991b1b",
        foreground: "#ffffff",
        border: "#dc2626",
      },
    },
  },
});
