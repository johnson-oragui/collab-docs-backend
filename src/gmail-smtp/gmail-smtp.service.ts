import { IEmailPayload } from '@/email/email.interface';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class GmailSmtpService implements OnModuleInit {
  private readonly logger = new Logger(GmailSmtpService.name);

  private readonly transporter: Transporter;

  private readonly emailFrom: string;

  constructor(private readonly configService: ConfigService) {
    const gmailUser = this.configService.getOrThrow<string>('GMAIL_USER');

    const gmailAppPassword = this.configService
      .getOrThrow<string>('GMAIL_APP_PASSWORD')
      .replace(/\s/g, '');

    this.emailFrom = this.configService.getOrThrow<string>('EMAIL_FROM');

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.verifyConnection();

      this.logger.log('Gmail SMTP connection verified');
    } catch (error) {
      this.logger.error(error)
      // A temporary SMTP outage should not prevent the API
      // from starting. The worker will retry failed deliveries.
      this.logger.warn(
        'Gmail SMTP verification failed. Email delivery may be temporarily unavailable.',
      );
    }
  }

  /**
   * Verifies that Gmail SMTP credentials and connectivity work.
   */
  async verifyConnection(): Promise<void> {
    await this.transporter.verify();
  }

  /**
   * Sends an email through Gmail SMTP.
   *
   * Errors are intentionally propagated to the caller so
   * BullMQ can retry failed deliveries.
   */
  async send(payload: IEmailPayload): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        ...(payload.text ? { text: payload.text } : {}),
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
