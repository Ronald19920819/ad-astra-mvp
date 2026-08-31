import "server-only";

import { Resend } from "resend";

// The ONLY module in AD Astra that imports or talks to the Resend SDK
// directly. Every application email (review-returned, outstanding-work
// reminders, inactivity reminders, mentor/parent escalation, Store
// notifications, ...) must call sendEmail() rather than constructing its
// own Resend client -- this keeps the provider swappable in one place and
// keeps RESEND_API_KEY out of every other file.

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export type SendEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

let cachedClient: Resend | null = null;

function getResendClient(): Resend {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
}

// Never silently reports success after a Resend failure -- callers must
// branch on `success` and are only guaranteed an `id` when it is `true`.
export async function sendEmail({
  to,
  subject,
  html,
  from,
}: SendEmailInput): Promise<SendEmailResult> {
  const sender = from ?? process.env.AD_ASTRA_EMAIL_FROM;
  if (!sender) {
    return {
      success: false,
      error: "No sender is configured (AD_ASTRA_EMAIL_FROM is not set).",
    };
  }

  try {
    const client = getResendClient();
    const result = await client.emails.send({ from: sender, to, subject, html });

    if (result.error) {
      return { success: false, error: result.error.message };
    }
    if (!result.data) {
      return { success: false, error: "Resend did not return a message id." };
    }

    return { success: true, id: result.data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown email send failure.",
    };
  }
}
