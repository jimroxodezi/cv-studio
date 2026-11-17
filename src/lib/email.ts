import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

type Mail = { to: string; subject: string; text: string; html?: string };

export async function sendMail(mail: Mail): Promise<{ delivered: boolean }> {
  if (!env.smtpHost) {
    logMail(mail, "mail:dev");
    return { delivered: false };
  }

  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
  });

  try {
    await transport.sendMail({
      from: env.mailFrom,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return { delivered: true };
  } catch (err) {
    // A broken SMTP setup must not block sign-in: fall back to the log and let
    // the caller show the link (invites) or rely on the log (sign-in links).
    console.error(
      `[mail] delivery to ${mail.to} failed, using the server log instead:`,
      err instanceof Error ? err.message : err,
    );
    logMail(mail, "mail:fallback");
    return { delivered: false };
  }
}

function logMail(mail: Mail, tag: string): void {
  console.info(`[${tag}] To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}`);
}

export async function sendLoginLink(email: string, url: string): Promise<{ delivered: boolean }> {
  return sendMail({
    to: email,
    subject: "Sign in to CV Studio",
    text: `Open this link to sign in. It expires in 20 minutes and can only be used once.\n\n${url}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Open this link to sign in. It expires in 20 minutes and can only be used once.</p><p><a href="${url}">Sign in to CV Studio</a></p><p>If you did not request this, ignore this email.</p>`,
  });
}

export async function sendInvite(email: string, url: string, inviter: string): Promise<{ delivered: boolean }> {
  return sendMail({
    to: email,
    subject: `${inviter} invited you to CV Studio`,
    text: `${inviter} invited you to CV Studio. Open this link to create your account. It expires in 7 days.\n\n${url}`,
    html: `<p>${inviter} invited you to CV Studio.</p><p><a href="${url}">Create your account</a></p><p>This link expires in 7 days.</p>`,
  });
}
