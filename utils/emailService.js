const nodemailer = require('nodemailer');

/**
 * Creates a transporter instance based on environment variables.
 * Returns null if SMTP configuration is not present.
 */
const getTransporter = () => {
    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
    const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.SMTP_PASSWORD;

    if (!host || !user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass
        }
    });
};

/**
 * Sends an invitation email to a prospective team member.
 *
 * @param {Object} options
 * @param {string} options.toEmail
 * @param {string} options.businessName
 * @param {string} options.inviterName
 * @param {string} options.role
 * @param {string} options.inviteLink
 * @param {Date|string} options.expiresAt
 * @returns {Promise<{ sent: boolean, reason?: string, inviteLink: string }>}
 */
const sendInvitationEmail = async ({ toEmail, businessName, inviterName, role, inviteLink, expiresAt }) => {
    const transporter = getTransporter();

    if (!transporter) {
        console.log(`[EmailService] SMTP not configured. Invitation link for ${toEmail}: ${inviteLink}`);
        return {
            sent: false,
            reason: 'smtp_not_configured',
            inviteLink
        };
    }

    const roleName = role === 'accountant' ? 'Accountant (Manager)' : 'Viewer (Read-Only)';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || '"ReconFlow" <noreply@reconflow.io>';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
        .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em; }
        .content { padding: 32px 28px; line-height: 1.6; font-size: 15px; }
        .badge { display: inline-block; background-color: #ecfdf5; color: #059669; font-weight: 600; padding: 4px 12px; border-radius: 9999px; font-size: 13px; margin: 4px 0; }
        .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin: 20px 0; }
        .btn-wrapper { text-align: center; margin: 32px 0 20px 0; }
        .btn { display: inline-block; background-color: #059669; color: #ffffff !important; text-decoration: none; padding: 14px 32px; font-weight: 600; font-size: 15px; border-radius: 9999px; box-shadow: 0 2px 4px rgba(5,150,105,0.2); }
        .link-text { word-break: break-all; color: #64748b; font-size: 12px; margin-top: 24px; }
        .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Join ${businessName} on ReconFlow</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p><strong>${inviterName || 'A team member'}</strong> has invited you to collaborate on <strong>${businessName}</strong>.</p>
          
          <div class="card">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b;">ASSIGNED ROLE</p>
            <p style="margin: 0; font-weight: 600; font-size: 16px; color: #0f172a;">${roleName}</p>
          </div>

          <p>Click the button below to review and accept the invitation:</p>
          
          <div class="btn-wrapper">
            <a href="${inviteLink}" class="btn" target="_blank">Accept Invitation</a>
          </div>

          <p class="link-text">
            If the button doesn't work, copy and paste this link in your browser:<br>
            <a href="${inviteLink}" style="color: #059669;">${inviteLink}</a>
          </p>
          
          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
            This invitation will expire in 48 hours. If you did not expect this invitation, you can safely ignore this email.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ReconFlow Automated Reconciliation System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    `;

    try {
        await transporter.sendMail({
            from: fromAddress,
            to: toEmail,
            subject: `Invitation to join ${businessName} on ReconFlow`,
            html: htmlContent,
            text: `You have been invited by ${inviterName || 'a team member'} to join ${businessName} on ReconFlow as ${roleName}.\n\nAccept the invitation by clicking: ${inviteLink}\n\nThis link is valid for 48 hours.`
        });
        console.log(`[EmailService] Invitation email successfully dispatched to ${toEmail}`);
        return { sent: true, inviteLink };
    } catch (err) {
        console.error(`[EmailService] Error sending email to ${toEmail}:`, err.message);
        return { sent: false, reason: err.message, inviteLink };
    }
};

module.exports = {
    sendInvitationEmail
};
