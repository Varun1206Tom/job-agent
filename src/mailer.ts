import "dotenv/config";
import nodemailer from "nodemailer";
import { existsSync } from "fs";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  family: 4,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  tls: { rejectUnauthorized: process.env.ALLOW_INSECURE_TLS !== "true" },
} as any);

const BLOCKED = /@(.+\.)?(example\.(com|org|net)|test|invalid|localhost)$/i;

export async function sendMail(to: string, subject: string, body: string): Promise<boolean> {
  const resumePath = process.env.RESUME_PATH || "resume.pdf";
  if (!existsSync(resumePath)) throw new Error(`Resume not found: ${resumePath}`);

  if (BLOCKED.test(to.trim())) {
    console.log(`[BLOCKED] ${to} is a fake test address. Not sent.`);
    return false;
  }

  if (process.env.DRY_RUN === "true") {
    console.log("[DRY RUN] Mail not actually sent.");
    return false;
  }

  await transporter.sendMail({
    from: `Varun <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text: body,
    attachments: [{ filename: "Varun_Resume.pdf", path: resumePath }],
  });
  return true;
}