import { appendFile } from 'node:fs/promises'
import nodemailer from 'nodemailer'
import { isLocal } from './db'

type Mail = { to: string; subject: string; text: string }

/** Local mode writes mails to the console and `.outbox.jsonl` (read by E2E tests); otherwise SMTP. */
export async function sendMail(mail: Mail) {
  if (isLocal) {
    console.log(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`)
    await appendFile('.outbox.jsonl', JSON.stringify(mail) + '\n')
    return
  }
  // RESEND_API_KEY is a shortcut for Resend's SMTP server; any other provider uses SMTP_URL.
  const key = process.env.RESEND_API_KEY
  const url = process.env.SMTP_URL ?? (key && `smtps://resend:${encodeURIComponent(key)}@smtp.resend.com:465`)
  if (!url) throw new Error('SMTP_URL (or RESEND_API_KEY) is not set')
  await nodemailer
    .createTransport(url)
    .sendMail({ from: process.env.MAIL_FROM ?? 'Gigg <no-reply@gigg.band>', ...mail })
}
