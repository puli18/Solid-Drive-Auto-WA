/**
 * Transactional email via Resend. When RESEND_API_KEY is missing the email is LOGGED instead of sent
 * (local dev / emulator / before the client's domain is verified).
 */
import { logger } from 'firebase-functions/v2';
import { Resend } from 'resend';
import { emailFrom, env } from './config';

export interface EmailAttachment {
  filename: string;
  /** Base64 string or Buffer. */
  content: string | Buffer;
  contentType?: string;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  /** Short tag for logs, e.g. "booking-confirmed". */
  tag?: string;
}

export interface SendEmailResult {
  id: string | null;
  /** true when no API key was set and the email was only logged. */
  logged: boolean;
}

let client: Resend | null = null;
function resend(): Resend | null {
  const key = env('RESEND_API_KEY');
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const r = resend();
  if (!r) {
    logger.info(`[email:not-sent] ${input.tag ?? ''} → ${[input.to].flat().join(', ')}: ${input.subject}`, {
      tag: input.tag,
      to: input.to,
      subject: input.subject,
      text: input.text ?? input.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000),
      attachments: input.attachments?.map((a) => a.filename),
    });
    return { id: null, logged: true };
  }
  const { data, error } = await r.emails.send({
    from: emailFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
    tags: input.tag ? [{ name: 'type', value: input.tag.replace(/[^a-zA-Z0-9_-]/g, '_') }] : undefined,
  });
  if (error) {
    logger.error('Resend send failed', { tag: input.tag, error });
    throw new Error(`Email send failed: ${error.message}`);
  }
  return { id: data?.id ?? null, logged: false };
}
