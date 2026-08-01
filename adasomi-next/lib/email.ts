import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : SMTP_PORT === 465;
const MAIL_FROM = process.env.MAIL_FROM || '"Adasomi Logistics" <deliveries@adasomilogistics.com>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;
if (smtpConfigured) {
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE, // true for 465 (SSL), false for 587 (STARTTLS)
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
} else {
    console.warn(
        'SMTP credentials (SMTP_USER / SMTP_PASS) are not set. ' +
        'Verification emails will be logged to the console instead of sent.'
    );
}

function verificationEmailHtml({ firstName, verifyUrl }: { firstName?: string; verifyUrl: string }) {
    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f5f9ff; padding:32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #cfe3fa;">
        <tr>
          <td style="background: linear-gradient(135deg, #8fc3ff 0%, #2f7dd8 100%); padding:28px 32px;">
            <span style="color:#ffffff; font-size:20px; font-weight:700; letter-spacing:0.5px;">Adasomi Logistics</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px; color:#1c2b3a; font-size:20px;">Confirm your email address</h2>
            <p style="margin:0 0 20px; color:#64748b; font-size:15px; line-height:1.6;">
              Hi ${firstName || 'there'}, thanks for signing up with Adasomi Logistics. Please confirm this is your
              email address to activate your account.
            </p>
            <div style="text-align:center; margin:28px 0;">
              <a href="${verifyUrl}"
                 style="background: linear-gradient(135deg, #8fc3ff 0%, #2f7dd8 100%); color:#ffffff; text-decoration:none;
                        font-weight:600; padding:14px 28px; border-radius:10px; display:inline-block;">
                Verify my email
              </a>
            </div>
            <p style="margin:0 0 8px; color:#64748b; font-size:13px; line-height:1.6;">
              Or paste this link into your browser:
            </p>
            <p style="margin:0 0 20px; word-break:break-all; font-size:13px;">
              <a href="${verifyUrl}" style="color:#1c5aa8;">${verifyUrl}</a>
            </p>
            <p style="margin:0; color:#94a3b8; font-size:12px;">
              This link expires in 24 hours. If you didn't create an Adasomi Logistics account, you can ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </div>`;
}

export async function sendVerificationEmail(
    user: { email: string; firstName?: string },
    rawToken: string
): Promise<{ sent: boolean; devMode: boolean; verifyUrl: string }> {
    const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;

    if (!smtpConfigured || !transporter) {
        console.log('--- Email verification link (SMTP not configured) ---');
        console.log(`To: ${user.email}`);
        console.log(verifyUrl);
        console.log('-------------------------------------------------------');
        return { sent: false, devMode: true, verifyUrl };
    }

    await transporter.sendMail({
        from: MAIL_FROM,
        to: user.email,
        subject: 'Verify your Adasomi Logistics account',
        html: verificationEmailHtml({ firstName: user.firstName, verifyUrl })
    });

    return { sent: true, devMode: false, verifyUrl };
}
