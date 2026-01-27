import type { EmailService } from './types';
import { ResendEmailService } from './resend';
import { ConsoleEmailService } from './console';

export type { EmailService } from './types';

export function createEmailService(env: { ENVIRONMENT?: string; RESEND_API_KEY?: string }): EmailService {
  if (env.ENVIRONMENT === 'development') {
    return new ConsoleEmailService();
  }
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required in non-development environments');
  }
  return new ResendEmailService(env.RESEND_API_KEY);
}
