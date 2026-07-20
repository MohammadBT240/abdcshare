import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/** The ONLY place the Resend SDK is used (guideline §13). */
@Injectable()
export class EmailDispatchService {
  private readonly logger = new Logger(EmailDispatchService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const key = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('EMAIL_FROM', 'ABDC Share <no-reply@example.com>');
    this.resend = key ? new Resend(key) : null;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — would send "${subject}" to ${to}`);
      return;
    }
    await this.resend.emails.send({ from: this.from, to, subject, html });
  }
}
