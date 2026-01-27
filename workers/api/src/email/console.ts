import type { EmailService } from './types';

export class ConsoleEmailService implements EmailService {
  async sendMagicLink(to: string, token: string, appUrl: string): Promise<void> {
    const magicLinkUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}`;
    console.log('─'.repeat(60));
    console.log('MAGIC LINK EMAIL');
    console.log('─'.repeat(60));
    console.log(`To: ${to}`);
    console.log(`Link: ${magicLinkUrl}`);
    console.log('─'.repeat(60));
  }
}
