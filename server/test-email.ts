import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY environment variable must be set");
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTestEmail(to: string): Promise<boolean> {
  try {
    console.log(`Sending test email to: ${to}`);
    
    const { data, error } = await resend.emails.send({
      from: 'Practice Toolbox <team@practicetoolbox.co.uk>',
      to: [to],
      subject: 'Test Email from Practice Toolbox',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3b82f6;">Test Email</h2>
          <p>This is a test email to verify email delivery is working correctly.</p>
          <p>If you receive this email, the system is configured properly.</p>
          <p>Best regards,<br>Practice Toolbox Team</p>
        </div>
      `,
      text: `
Test Email

This is a test email to verify email delivery is working correctly.
If you receive this email, the system is configured properly.

Best regards,
Practice Toolbox Team
      `,
    });

    if (error) {
      console.error('Test email error:', error);
      return false;
    }

    console.log('Test email sent successfully:', data?.id);
    return true;
  } catch (error) {
    console.error('Failed to send test email:', error);
    return false;
  }
}