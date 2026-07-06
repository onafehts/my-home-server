import nodemailer from "nodemailer";
import { env } from "./env";

/**
 * SMTP transport for OTP delivery. In local dev this points at Mailpit
 * (localhost:1025) and you read the code at http://localhost:8025.
 */
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: env.SMTP_USER
    ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
    : undefined,
});

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Your Arena login code: ${otp}`,
    text: `Your one-time login code is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your one-time login code is <strong style="font-size:22px;letter-spacing:2px">${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
  console.log(`[email] OTP sent to ${to}`);
}
