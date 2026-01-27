export interface EmailService {
  sendMagicLink(to: string, token: string, appUrl: string): Promise<void>;
}
