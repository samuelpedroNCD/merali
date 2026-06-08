import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Merali Lettings <noreply@merali-lettings.co.uk>";

/**
 * Send an email via Resend. No-op (returns false) when RESEND_API_KEY is
 * absent, so the app works without email configured.
 */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch {
    return false;
  }
}

export function emailEnabled() {
  return Boolean(apiKey);
}
