import { appendFile } from 'node:fs/promises'
import nodemailer from 'nodemailer'
import { isLocal } from './db'

type Mail = { to: string; subject: string; text: string }

/** Local mode writes mails to the console and `.outbox.jsonl` (read by E2E tests); otherwise SMTP_URL. */
export async function sendMail(mail: Mail) {
  if (isLocal) {
    console.log(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`)
    await appendFile('.outbox.jsonl', JSON.stringify(mail) + '\n')
    return
  }
  if (!process.env.SMTP_URL) throw new Error('SMTP_URL is not set')
  await nodemailer
    .createTransport(process.env.SMTP_URL)
    .sendMail({ from: process.env.MAIL_FROM ?? 'Gigg <no-reply@gigg.band>', ...mail })
}
