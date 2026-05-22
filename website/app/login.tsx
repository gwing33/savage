import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";
import { theme } from "remix/ui/theme";
import { AppTheme } from "./theme.ts";

// ─── Shared page shell styles ────────────────────────────────────────────────

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

// ─── Nav ─────────────────────────────────────────────────────────────────────

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

// ─── Card layout ─────────────────────────────────────────────────────────────

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
  boxShadow: theme.shadow.lg,
  padding: "48px",
  width: "100%",
  maxWidth: "440px",
});

const headingStyles = css({
  fontSize: "26px",
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.text.primary,
  margin: "0",
  letterSpacing: "-0.02em",
  marginBottom: "8px",
});

const subheadingStyles = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
  margin: "0",
  marginBottom: "32px",
  lineHeight: theme.lineHeight.relaxed,
});

// ─── Form elements ────────────────────────────────────────────────────────────

const formStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: "20px",
});

const fieldGroupStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});

const labelStyles = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  color: theme.colors.text.secondary,
});

const inputStyles = css({
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  padding: "10px 14px",
  fontSize: theme.fontSize.md,
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: theme.fontFamily.sans,
});

const codeInputStyles = css({
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  padding: "14px",
  fontSize: "28px",
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: theme.fontFamily.mono,
  textAlign: "center",
  letterSpacing: "0.3em",
});

const submitButtonStyles = css({
  backgroundColor: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: "none",
  borderRadius: theme.radius.md,
  padding: "12px 24px",
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  cursor: "pointer",
  fontFamily: theme.fontFamily.sans,
  width: "100%",
  marginTop: "4px",
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

const alertErrorStyles = css({
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: theme.radius.md,
  padding: "12px 16px",
  color: "#dc2626",
  fontSize: theme.fontSize.sm,
});

const backLinkStyles = css({
  display: "block",
  textAlign: "center",
  marginTop: "24px",
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
  textDecoration: "none",
});

const emailHighlightStyles = css({
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
});

// ─── Components ──────────────────────────────────────────────────────────────

function AuthNav(_handle: Handle): () => RemixNode {
  return () => (
    <nav mix={navStyles}>
      <a href="/" mix={navLogoStyles}>
        Savage
      </a>
    </nav>
  );
}

// ── Login page (email entry) ──────────────────────────────────────────────────

export interface LoginPageProps {
  error?: string;
}

export function LoginPage(handle: Handle<LoginPageProps>): () => RemixNode {
  return () => (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Log in — Savage</title>
        <AppTheme />
        <style>{`
          @layer base, rmx-reset, rmx;
          @layer base {
            *, *::before, *::after { box-sizing: border-box; }
          }
        `}</style>
      </head>
      <body mix={bodyStyles}>
        <AuthNav />
        <main mix={mainStyles}>
          <div mix={cardStyles}>
            <h1 mix={headingStyles}>Log in to Savage</h1>
            <p mix={subheadingStyles}>
              Enter your email and we'll send you a one-time code to sign in. No
              password needed.
            </p>

            {handle.props.error && (
              <p mix={alertErrorStyles}>{handle.props.error}</p>
            )}

            <form action="/login" method="post" mix={formStyles}>
              <div mix={fieldGroupStyles}>
                <label for="email" mix={labelStyles}>
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autocomplete="email"
                  mix={inputStyles}
                />
              </div>
              <button type="submit" mix={submitButtonStyles}>
                Send code
              </button>
            </form>
          </div>
        </main>
      </body>
    </html>
  );
}

// ── Verify page (code entry) ──────────────────────────────────────────────────

export interface VerifyPageProps {
  email: string;
  error?: string;
}

export function VerifyPage(handle: Handle<VerifyPageProps>): () => RemixNode {
  const { email, error } = handle.props;
  return () => (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Enter code — Savage</title>
        <AppTheme />
        <style>{`
          @layer base, rmx-reset, rmx;
          @layer base {
            *, *::before, *::after { box-sizing: border-box; }
          }
        `}</style>
      </head>
      <body mix={bodyStyles}>
        <AuthNav />
        <main mix={mainStyles}>
          <div mix={cardStyles}>
            <h1 mix={headingStyles}>Check your email</h1>
            <p mix={subheadingStyles}>
              We sent a 6-digit code to{" "}
              <span mix={emailHighlightStyles}>{email}</span>. Paste it below —
              it expires in 10 minutes.
            </p>

            {error && <p mix={alertErrorStyles}>{error}</p>}

            <form action="/login/verify" method="post" mix={formStyles}>
              <input type="hidden" name="email" value={email} />
              <div mix={fieldGroupStyles}>
                <label for="code" mix={labelStyles}>
                  One-time code
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  maxlength={6}
                  required
                  autocomplete="one-time-code"
                  mix={codeInputStyles}
                />
              </div>
              <button type="submit" mix={submitButtonStyles}>
                Verify code
              </button>
            </form>

            <a href="/login" mix={backLinkStyles}>
              ← Use a different email
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
