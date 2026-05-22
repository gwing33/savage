import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";
import { theme } from "remix/ui/theme";
import { AppTheme } from "./theme.ts";

// ─── Styles ──────────────────────────────────────────────────────────────────

const bodyStyles = css({
  margin: "0",
  padding: "0",
  fontFamily: theme.fontFamily.sans,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
});

// Nav ─────────────────────────────────────────────────────────────────────────

const navStyles = css({
  position: "sticky",
  top: "0",
  backgroundColor: "rgb(15 23 42 / 0.97)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgb(255 255 255 / 0.08)",
  paddingBlock: "16px",
  paddingInline: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  zIndex: "1200",
});

const navLogoStyles = css({
  fontSize: "22px",
  fontWeight: theme.fontWeight.bold,
  color: "#ffffff",
  textDecoration: "none",
  letterSpacing: "-0.03em",
});

const navLinksStyles = css({
  display: "flex",
  gap: "32px",
  alignItems: "center",
  listStyle: "none",
  margin: "0",
  padding: "0",
});

const navLinkStyles = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  color: "rgb(148 163 184)",
  textDecoration: "none",
});

const navCtaStyles = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: "#0ea5e9",
  textDecoration: "none",
  border: "1px solid rgb(14 165 233 / 0.4)",
  borderRadius: theme.radius.full,
  paddingBlock: "8px",
  paddingInline: "20px",
});

// Hero ────────────────────────────────────────────────────────────────────────

const heroStyles = css({
  background: "linear-gradient(140deg, #0f172a 0%, #1e293b 55%, #0c4a6e 100%)",
  paddingBlock: "140px 120px",
  paddingInline: "32px",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
});

const heroBadgeStyles = css({
  display: "inline-block",
  backgroundColor: "rgb(14 165 233 / 0.12)",
  border: "1px solid rgb(14 165 233 / 0.3)",
  borderRadius: theme.radius.full,
  paddingBlock: "6px",
  paddingInline: "16px",
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: "#38bdf8",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: "28px",
});

const heroTitleStyles = css({
  fontSize: "80px",
  fontWeight: theme.fontWeight.bold,
  color: "#ffffff",
  margin: "0",
  letterSpacing: "-0.05em",
  lineHeight: theme.lineHeight.tight,
  marginBottom: "12px",
});

const heroSubtitleStyles = css({
  fontSize: "26px",
  fontWeight: theme.fontWeight.normal,
  color: "rgb(148 163 184)",
  margin: "0",
  marginBottom: "24px",
  maxWidth: "580px",
  letterSpacing: "-0.01em",
});

const heroBodyStyles = css({
  fontSize: theme.fontSize.lg,
  color: "rgb(100 116 139)",
  maxWidth: "540px",
  margin: "0",
  marginBottom: "48px",
  lineHeight: theme.lineHeight.relaxed,
});

const heroCtaGroupStyles = css({
  display: "flex",
  gap: "16px",
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "center",
});

const heroCtaPrimaryStyles = css({
  display: "inline-block",
  backgroundColor: "#0ea5e9",
  color: "#ffffff",
  borderRadius: theme.radius.md,
  paddingBlock: "16px",
  paddingInline: "36px",
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  textDecoration: "none",
});

const heroCtaSecondaryStyles = css({
  display: "inline-block",
  backgroundColor: "transparent",
  color: "rgb(148 163 184)",
  borderRadius: theme.radius.md,
  paddingBlock: "16px",
  paddingInline: "36px",
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.medium,
  textDecoration: "none",
  border: "1px solid rgb(255 255 255 / 0.12)",
});

// Shared section layout ───────────────────────────────────────────────────────

const sectionStyles = css({
  paddingBlock: "96px",
  paddingInline: "32px",
});

const sectionAltStyles = css({
  paddingBlock: "96px",
  paddingInline: "32px",
  backgroundColor: theme.surface.lvl1,
});

const containerStyles = css({
  maxWidth: "1100px",
  marginInline: "auto",
});

const sectionHeaderStyles = css({
  maxWidth: "640px",
  marginBottom: "56px",
});

const sectionLabelStyles = css({
  display: "inline-block",
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: "#0ea5e9",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: "12px",
});

const sectionTitleStyles = css({
  fontSize: "38px",
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.text.primary,
  margin: "0",
  marginBottom: "12px",
  letterSpacing: "-0.025em",
  lineHeight: theme.lineHeight.tight,
});

const sectionDescStyles = css({
  fontSize: theme.fontSize.lg,
  color: theme.colors.text.muted,
  margin: "0",
  lineHeight: theme.lineHeight.relaxed,
});

// Features ────────────────────────────────────────────────────────────────────

const featuresGridStyles = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "24px",
});

const featureCardStyles = css({
  backgroundColor: theme.surface.lvl0,
  borderRadius: theme.radius.xl,
  padding: "32px",
  border: `1px solid ${theme.colors.border.subtle}`,
  boxShadow: theme.shadow.sm,
});

const featureIconStyles = css({
  fontSize: "28px",
  marginBottom: "20px",
  display: "block",
  lineHeight: "1",
});

const featureTitleStyles = css({
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  margin: "0",
  marginBottom: "8px",
});

const featureDescStyles = css({
  fontSize: theme.fontSize.md,
  color: theme.colors.text.muted,
  lineHeight: theme.lineHeight.relaxed,
  margin: "0",
});

// FAQ ─────────────────────────────────────────────────────────────────────────

const faqListStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  maxWidth: "800px",
});

const faqItemStyles = css({
  backgroundColor: theme.surface.lvl0,
  borderRadius: theme.radius.xl,
  border: `1px solid ${theme.colors.border.subtle}`,
  overflow: "hidden",
  boxShadow: theme.shadow.xs,
});

const faqSummaryStyles = css({
  padding: "24px 28px",
  cursor: "pointer",
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  userSelect: "none",
  gap: "16px",
});

const faqAnswerStyles = css({
  paddingInline: "28px",
  paddingBottom: "24px",
  fontSize: theme.fontSize.md,
  color: theme.colors.text.secondary,
  lineHeight: theme.lineHeight.relaxed,
  margin: "0",
});

// Contact ─────────────────────────────────────────────────────────────────────

const formStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  maxWidth: "620px",
});

const formRowStyles = css({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
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
  padding: "12px 16px",
  fontSize: theme.fontSize.md,
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
});

const textareaStyles = css({
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  padding: "12px 16px",
  fontSize: theme.fontSize.md,
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
  minHeight: "140px",
  fontFamily: "inherit",
  lineHeight: theme.lineHeight.relaxed,
});

const submitButtonStyles = css({
  backgroundColor: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: "none",
  borderRadius: theme.radius.md,
  padding: "14px 32px",
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  cursor: "pointer",
  alignSelf: "flex-start",
  fontFamily: "inherit",
});

const alertSuccessStyles = css({
  backgroundColor: "rgb(16 185 129 / 0.08)",
  border: "1px solid rgb(16 185 129 / 0.25)",
  borderRadius: theme.radius.lg,
  padding: "16px 20px",
  color: "#065f46",
  fontSize: theme.fontSize.md,
  marginBottom: "24px",
});

const alertErrorStyles = css({
  backgroundColor: "rgb(239 68 68 / 0.08)",
  border: "1px solid rgb(239 68 68 / 0.25)",
  borderRadius: theme.radius.lg,
  padding: "16px 20px",
  color: "#7f1d1d",
  fontSize: theme.fontSize.md,
  marginBottom: "24px",
});

// Footer ──────────────────────────────────────────────────────────────────────

const footerStyles = css({
  backgroundColor: "#0f172a",
  paddingBlock: "48px",
  paddingInline: "32px",
});

const footerInnerStyles = css({
  maxWidth: "1100px",
  marginInline: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "16px",
});

const footerLogoStyles = css({
  fontSize: "18px",
  fontWeight: theme.fontWeight.bold,
  color: "#ffffff",
  textDecoration: "none",
  letterSpacing: "-0.03em",
});

const footerTextStyles = css({
  fontSize: theme.fontSize.sm,
  color: "rgb(100 116 139)",
  margin: "0",
});

// ─── Components ──────────────────────────────────────────────────────────────
// All remix/ui custom components must receive a Handle and return a render fn.

function Nav(_handle: Handle): () => RemixNode {
  return () => (
    <nav mix={navStyles}>
      <a href="/" mix={navLogoStyles}>
        Savage
      </a>
      <ul mix={navLinksStyles}>
        <li>
          <a href="#features" mix={navLinkStyles}>
            Features
          </a>
        </li>
        <li>
          <a href="#faq" mix={navLinkStyles}>
            FAQ
          </a>
        </li>
        <li>
          <a href="#contact" mix={navCtaStyles}>
            Get Early Access
          </a>
        </li>
      </ul>
    </nav>
  );
}

function Hero(_handle: Handle): () => RemixNode {
  return () => (
    <section mix={heroStyles}>
      <span mix={heroBadgeStyles}>Smart Home Air Quality</span>
      <h1 mix={heroTitleStyles}>Savage</h1>
      <p mix={heroSubtitleStyles}>
        Whole-home air quality, captured at the source.
      </p>
      <p mix={heroBodyStyles}>
        A whisper-quiet cassette filter installed above your range. Built-in
        sensors continuously monitor air quality and automatically adjust flow —
        even signaling your ERV or HRV to bring in fresh air when you need it
        most.
      </p>
      <div mix={heroCtaGroupStyles}>
        <a href="#contact" mix={heroCtaPrimaryStyles}>
          Get Early Access
        </a>
        <a href="#features" mix={heroCtaSecondaryStyles}>
          See How It Works
        </a>
      </div>
    </section>
  );
}

interface FeatureProps {
  icon: string;
  title: string;
  description: string;
}

function Feature(handle: Handle<FeatureProps>): () => RemixNode {
  return () => (
    <div mix={featureCardStyles}>
      <span mix={featureIconStyles}>{handle.props.icon}</span>
      <h3 mix={featureTitleStyles}>{handle.props.title}</h3>
      <p mix={featureDescStyles}>{handle.props.description}</p>
    </div>
  );
}

function Features(_handle: Handle): () => RemixNode {
  return () => (
    <section id="features" mix={sectionStyles}>
      <div mix={containerStyles}>
        <header mix={sectionHeaderStyles}>
          <span mix={sectionLabelStyles}>How It Works</span>
          <h2 mix={sectionTitleStyles}>Engineered for Modern Homes</h2>
          <p mix={sectionDescStyles}>
            Every detail designed to improve your indoor air quality — without
            interrupting the way you live.
          </p>
        </header>
        <div mix={featuresGridStyles}>
          <Feature
            icon="🌀"
            title="Always-On Filtration"
            description="Low-flow design runs continuously and silently. No sudden blasts of noise — just constant, gentle air cleaning throughout the day."
          />
          <Feature
            icon="📡"
            title="Smart Air Quality Sensors"
            description="Built-in PM2.5, VOC, and CO₂ sensors detect what's in the air and automatically adjust filtration intensity in real time."
          />
          <Feature
            icon="🔗"
            title="ERV / HRV Integration"
            description="Communicates directly with your balanced ventilation system to request a fresh-air boost exactly when cooking generates the most particles."
          />
          <Feature
            icon="📍"
            title="Source Capture"
            description="Installed right above the range where particles originate. Capture them before they spread through the rest of your home."
          />
          <Feature
            icon="🔇"
            title="Whisper Quiet"
            description="Low-pressure, high-efficiency operation. You'll forget it's running — until you check the air quality dashboard."
          />
          <Feature
            icon="🏠"
            title="No Make-Up Air Required"
            description="Works entirely within your home's existing air envelope. No costly make-up air systems, no unmanaged infiltration, no depressurization risk."
          />
        </div>
      </div>
    </section>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem(handle: Handle<FAQItemProps>): () => RemixNode {
  return () => (
    <details mix={faqItemStyles}>
      <summary mix={faqSummaryStyles}>
        <span>{handle.props.question}</span>
        <span aria-hidden="true">&#x25BE;</span>
      </summary>
      <p mix={faqAnswerStyles}>{handle.props.answer}</p>
    </details>
  );
}

function FAQ(_handle: Handle): () => RemixNode {
  return () => (
    <section id="faq" mix={sectionAltStyles}>
      <div mix={containerStyles}>
        <header mix={sectionHeaderStyles}>
          <span mix={sectionLabelStyles}>FAQ</span>
          <h2 mix={sectionTitleStyles}>Questions &amp; Answers</h2>
          <p mix={sectionDescStyles}>
            Everything you want to know about how Savage handles your home's
            air.
          </p>
        </header>
        <div mix={faqListStyles}>
          <FAQItem
            question="Does this filter or vent?"
            answer="Filter. We opted for filtering over venting primarily for buildings that are already air-tight and have a balanced ventilation system (ERV or HRV). By placing a whole-home filter at the primary source of particle generation, we capture most of it right away and let the ERV/HRV also filter and vent out the particles that escaped."
          />
          <FAQItem
            question="Can it boost air flow to my ERV / HRV?"
            answer="Yes. This is one of the main reasons we built it — we let the existing air management system bring in fresh air. This device is largely to help improve air quality as you cook. When sensors detect elevated particle levels, Savage signals your ERV/HRV to increase its fresh-air intake automatically."
          />
          <FAQItem
            question="Why not vent?"
            answer="Venting requires some sort of make-up air system. Exhausting 1,000 CFM to the outside means 1,000 CFM must come in from outside. Most make-up air systems aren't filtered and have no heat recovery. Even worse: if no make-up air system is in place, large quantities of air enter through unmanaged routes — causing mold and rot in the worst case, and degrading building performance in the best case."
          />
        </div>
      </div>
    </section>
  );
}

export interface ContactProps {
  success?: boolean;
  error?: string;
}

function Contact(handle: Handle<ContactProps>): () => RemixNode {
  return () => (
    <section id="contact" mix={sectionStyles}>
      <div mix={containerStyles}>
        <header mix={sectionHeaderStyles}>
          <span mix={sectionLabelStyles}>Contact</span>
          <h2 mix={sectionTitleStyles}>Get in Touch</h2>
          <p mix={sectionDescStyles}>
            Hello? Interested in Savage for your home? Leave your details and we
            will reach out when pre-orders open.
          </p>
        </header>

        {handle.props.success ? (
          <div mix={alertSuccessStyles}>
            <strong>Thanks for reaching out!</strong> We have added you to our
            early-access list and will be in touch soon.
          </div>
        ) : (
          <>
            {handle.props.error && (
              <div mix={alertErrorStyles}>{handle.props.error}</div>
            )}
            <form method="POST" action="/contact" mix={formStyles}>
              <div mix={formRowStyles}>
                <div mix={fieldGroupStyles}>
                  <label for="name" mix={labelStyles}>
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder="Your name"
                    required
                    autocomplete="name"
                    mix={inputStyles}
                  />
                </div>
                <div mix={fieldGroupStyles}>
                  <label for="email" mix={labelStyles}>
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="you@example.com"
                    required
                    autocomplete="email"
                    mix={inputStyles}
                  />
                </div>
              </div>
              <div mix={fieldGroupStyles}>
                <label for="message" mix={labelStyles}>
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Tell us about your home setup, ask a question, or just say hello..."
                  required
                  mix={textareaStyles}
                />
              </div>
              <button type="submit" mix={submitButtonStyles}>
                Send Message
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

function Footer(_handle: Handle): () => RemixNode {
  return () => (
    <footer mix={footerStyles}>
      <div mix={footerInnerStyles}>
        <a href="/" mix={footerLogoStyles}>
          Savage
        </a>
        <p mix={footerTextStyles}>
          {"© "}
          {new Date().getFullYear()}
          {" Savage. All rights reserved."}
        </p>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export interface HomePageProps {
  success?: boolean;
  error?: string;
}

export function HomePage(handle: Handle<HomePageProps>): () => RemixNode {
  return () => (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Savage — Smart Range Air Filtration</title>
        <meta
          name="description"
          content="A whisper-quiet cassette filter that captures particles at the source, works with your ERV/HRV, and automatically adjusts for whole-home air quality."
        />
        <AppTheme />
        <style>{`
          @layer base, rmx-reset, rmx;
          @layer base {
            *, *::before, *::after { box-sizing: border-box; }
            img, video { max-width: 100%; display: block; }
            details > summary { list-style: none; }
            details > summary::-webkit-details-marker { display: none; }
          }
        `}</style>
      </head>
      <body mix={bodyStyles}>
        <Nav />
        <main>
          <Hero />
          <Features />
          <FAQ />
          <Contact success={handle.props.success} error={handle.props.error} />
        </main>
        <Footer />
      </body>
    </html>
  );
}
