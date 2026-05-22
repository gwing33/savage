// ─── Mailer ───────────────────────────────────────────────────────────────────
//
// Dev  → sends via SMTP to Mailpit (SMTP_HOST / SMTP_PORT env vars).
//         Mailpit catches all outbound mail; view at http://localhost:8025.
//
// Prod → sends via Resend REST API when RESEND_API_KEY is set.
//
// Detection: RESEND_API_KEY present → Resend, otherwise → SMTP.

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(opts);
  } else {
    await sendViaSMTP(opts);
  }
}

// ── Resend ────────────────────────────────────────────────────────────────────

async function sendViaResend({ to, subject, html, text }: MailOptions) {
  const from =
    process.env.EMAIL_FROM ?? "Savage <noreply@savagesensors.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[mailer] Resend error ${res.status}: ${body}`);
  }
}

// ── SMTP (Mailpit in dev) ─────────────────────────────────────────────────────

async function sendViaSMTP({ to, subject, html, text }: MailOptions) {
  // Dynamic import keeps nodemailer out of the module graph in prod when
  // RESEND_API_KEY is set (though it still lands in node_modules).
  const nodemailer = (await import("nodemailer")).default;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    // Mailpit doesn't need auth and doesn't offer STARTTLS by default.
    ignoreTLS: true,
    auth: undefined,
  });

  const from = process.env.EMAIL_FROM ?? "Savage <noreply@savage.local>";

  await transporter.sendMail({ from, to, subject, html, text });
  console.log(`[mailer] SMTP → ${to} | ${subject}`);
}
