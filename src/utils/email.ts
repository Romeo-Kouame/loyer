import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/environment';
import { logger } from './logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!config.email.host) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: config.email.user ? { user: config.email.user, pass: config.email.password } : undefined,
    });
  }
  return transporter;
}

// Best-effort: notifications must never break the business action they're
// attached to. If SMTP isn't configured (e.g. local dev), this just logs.
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const client = getTransporter();

  if (!client) {
    logger.info(`[email skipped - SMTP not configured] to=${params.to} subject="${params.subject}"`);
    return;
  }

  try {
    await client.sendMail({ from: config.email.from, to: params.to, subject: params.subject, html: params.html });
  } catch (err) {
    logger.warn(`Failed to send email to ${params.to}: ${err}`);
  }
}
