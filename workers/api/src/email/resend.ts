import type { EmailService } from './types';

export class ResendEmailService implements EmailService {
  constructor(private apiKey: string) {}

  async sendMagicLink(to: string, token: string, appUrl: string): Promise<void> {
    const magicLinkUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Relay <noreply@relay.dev>',
        to: [to],
        subject: 'Sign in to Relay',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 24px; color: #111;">Sign in to Relay</h1>
            <p style="font-size: 16px; color: #333; margin-bottom: 24px; line-height: 1.5;">
              Click the button below to sign in to your Relay account. This link will expire in 15 minutes.
            </p>
            <a href="${magicLinkUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 500;">
              Sign in to Relay
            </a>
            <p style="font-size: 14px; color: #666; margin-top: 32px; line-height: 1.5;">
              If you didn't request this email, you can safely ignore it.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
            <p style="font-size: 12px; color: #999;">
              This link will expire in 15 minutes. If the button doesn't work, copy and paste this URL into your browser:
            </p>
            <p style="font-size: 12px; color: #666; word-break: break-all;">
              ${magicLinkUrl}
            </p>
          </div>
        `,
        text: `Sign in to Relay\n\nClick the link below to sign in to your Relay account. This link will expire in 15 minutes.\n\n${magicLinkUrl}\n\nIf you didn't request this email, you can safely ignore it.`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }
  }
}
