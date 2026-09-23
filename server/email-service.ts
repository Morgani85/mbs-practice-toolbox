import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY environment variable must be set");
}

const resend = new Resend(process.env.RESEND_API_KEY);

interface PasswordResetEmailParams {
  to: string;
  firstName?: string | null;
  resetToken: string;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<boolean> {
  try {
    const { to, firstName, resetToken } = params;
    const name = firstName || 'there';
    const resetUrl = `https://app.practicetoolbox.co.uk/auth?reset_token=${resetToken}`;
    const fromEmail = 'Practice Toolbox <team@practicetoolbox.co.uk>';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Reset your Practice Toolbox password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="background: #3b82f6; color: white; text-align: center; padding: 20px;">
            <img src="https://app.practicetoolbox.co.uk/attached_assets/Screenshot%202025-07-02%20at%2016.25.36_1751469958155.png" alt="Practice Toolbox" style="height: 40px; margin-bottom: 10px;">
            <h1 style="margin: 0; font-size: 24px;">Practice Toolbox</h1>
          </div>
          <div style="padding: 30px;">
            <p>Hi ${name},</p>
            <p>We received a request to reset your Practice Toolbox password. Click the button below to choose a new one:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; display: inline-block; font-weight: bold;">Reset My Password</a>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
          </div>
        </div>
      </body>
    </html>`;

    const textContent = `Hi ${name},\n\nWe received a request to reset your Practice Toolbox password.\n\nReset your password by visiting:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nPractice Toolbox Team`;

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: 'Reset your Practice Toolbox password',
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error('Password reset email error:', error);
      return false;
    }

    console.log('Password reset email sent:', data?.id);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

interface InvitationEmailParams {
  to: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  invitationToken: string;
  inviterName?: string;
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<boolean> {
  try {
    const { to, firstName, lastName, role, invitationToken, inviterName = "Practice Toolbox Admin" } = params;
    
    // Domain is now verified, so we can send to any email address
    
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'New User';
    // Use production domain to match sending domain and avoid spam filters
    const setupUrl = `https://app.practicetoolbox.co.uk/auth?token=${invitationToken}`;
    
    const subject = `You've been invited to Practice Toolbox`;
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Practice Toolbox Invitation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="background: #3b82f6; color: white; text-align: center; padding: 20px;">
            <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
              <img src="https://app.practicetoolbox.co.uk/attached_assets/Screenshot%202025-07-02%20at%2016.25.36_1751469958155.png" alt="Practice Toolbox" style="height: 40px; margin-right: 10px;">
            </div>
            <h1 style="margin: 0; font-size: 24px;">Practice Toolbox</h1>
            <p style="margin: 10px 0 0 0;">Team Performance Analytics</p>
          </div>
          
          <div style="padding: 30px;">
            <p>Hello ${fullName},</p>
            
            <p>You have been invited by ${inviterName} to join Practice Toolbox, our team performance analytics platform.</p>
            
            <p>Your account has been set up with the role: <strong>${role}</strong></p>
            
            <p>To complete your account setup and create your password, click the link below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${setupUrl}" style="background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; display: inline-block;">Complete Account Setup</a>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3b82f6;">${setupUrl}</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">This invitation link will expire in 7 days.</p>
            <p style="color: #666; font-size: 14px;">If you have any questions, please contact your system administrator.</p>
          </div>
        </div>
      </body>
    </html>
    `;

    const textContent = `
Hello ${fullName},

You have been invited by ${inviterName} to join Practice Toolbox, our comprehensive team performance analytics platform.

Your account has been set up with the role: ${role}

To complete your account setup and create your password, visit:
${setupUrl}

What you'll have access to:
- Real-time performance dashboards
- Team analytics and insights  
- Module-specific tracking (Accounts, VAT, Bookkeeping, etc.)
- AI-powered performance analysis
- Executive overview reports

This invitation link will expire in 7 days for security purposes.

If you have any questions, please contact your system administrator.

Best regards,
Practice Toolbox Team
    `;

    // Use your verified domain for email sending - avoid noreply to improve deliverability
    const fromEmail = 'Practice Toolbox <team@practicetoolbox.co.uk>';

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Entity-Ref-ID': invitationToken,
      },
      tags: [
        {
          name: 'category',
          value: 'invitation'
        }
      ]
    });

    if (error) {
      console.error('Resend email error:', error);
      return false;
    }

    console.log('Invitation email sent successfully:', data?.id);
    console.log('Email details:', { from: fromEmail, to, subject });
    console.log('Check Resend dashboard for delivery status at: https://resend.com/emails');
    return true;
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return false;
  }
}