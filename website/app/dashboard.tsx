import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";
import { theme } from "remix/ui/theme";
import { AppTheme } from "./theme.ts";

// ─── Styles ───────────────────────────────────────────────────────────────────

const bodyStyles = css({
  margin: "0",
  padding: "0",
  fontFamily: theme.fontFamily.sans,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl1,
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
});

const navStyles = css({
  backgroundColor: "rgb(15 23 42 / 0.97)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgb(255 255 255 / 0.08)",
  paddingBlock: "16px",
  paddingInline: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

const navLogoStyles = css({
  fontSize: "22px",
  fontWeight: theme.fontWeight.bold,
  color: "#ffffff",
  textDecoration: "none",
  letterSpacing: "-0.03em",
});

const navRightStyles = css({
  display: "flex",
  alignItems: "center",
  gap: "20px",
});

const navEmailStyles = css({
  fontSize: theme.fontSize.sm,
  color: "rgb(148 163 184)",
});

const logoutButtonStyles = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  color: "rgb(148 163 184)",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: theme.fontFamily.sans,
  padding: "0",
});

const mainStyles = css({
  flex: "1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  paddingBlock: "64px",
  paddingInline: "24px",
});

const cardStyles = css({
  backgroundColor: theme.surface.lvl0,
  borderRadius: theme.radius.xl,
  border: `1px solid ${theme.colors.border.subtle}`,
  boxShadow: theme.shadow.md,
  padding: "48px",
  width: "100%",
  maxWidth: "520px",
});

const greetingStyles = css({
  fontSize: "32px",
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.text.primary,
  margin: "0",
  letterSpacing: "-0.02em",
  marginBottom: "8px",
});

const subtextStyles = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
  margin: "0",
  marginBottom: "32px",
});

const badgeStyles = css({
  display: "inline-block",
  backgroundColor: theme.surface.lvl2,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.full,
  paddingBlock: "4px",
  paddingInline: "12px",
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: "uppercase",
});

// ─── Component ────────────────────────────────────────────────────────────────

export interface DashboardPageProps {
  user: { email: string; type: string };
}

export function DashboardPage(
  handle: Handle<DashboardPageProps>,
): () => RemixNode {
  const { email, type } = handle.props.user;
  // Use the local part of the email as a friendly display name.
  const name = email.split("@")[0];

  return () => (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Dashboard — Savage</title>
        <AppTheme />
        <style>{`
          @layer base, rmx-reset, rmx;
          @layer base {
            *, *::before, *::after { box-sizing: border-box; }
          }
        `}</style>
      </head>
      <body mix={bodyStyles}>
        <nav mix={navStyles}>
          <a href="/" mix={navLogoStyles}>
            Savage
          </a>
          <div mix={navRightStyles}>
            <span mix={navEmailStyles}>{email}</span>
            <form action="/logout" method="post">
              <button type="submit" mix={logoutButtonStyles}>
                Log out
              </button>
            </form>
          </div>
        </nav>

        <main mix={mainStyles}>
          <div mix={cardStyles}>
            <h1 mix={greetingStyles}>Hello, {name}.</h1>
            <p mix={subtextStyles}>Welcome to your Savage dashboard.</p>
            <span mix={badgeStyles}>{type}</span>
          </div>
        </main>
      </body>
    </html>
  );
}
