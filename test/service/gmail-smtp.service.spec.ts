import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { GmailSmtpService } from '@/gmail-smtp/gmail-smtp.service';
import { IEmailPayload } from '@/email/email.interface';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('Test EmailSmtpService', () => {
  let service: GmailSmtpService;

  let verifyMock: jest.Mock;
  let sendMailMock: jest.Mock;

  const configValues: Record<string, string> = {
    GMAIL_USER: 'sender@gmail.com',
    GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
    EMAIL_FROM: 'Collab Docs <sender@gmail.com>',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    verifyMock = jest.fn().mockResolvedValue(true);
    sendMailMock = jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
    });

    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      verify: verifyMock,
      sendMail: sendMailMock,
    });

    const configService = {
      getOrThrow: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;

    service = new GmailSmtpService(configService);
  });

  it('should configure Gmail SMTP with TLS', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'sender@gmail.com',
        pass: 'abcdefghijklmnop',
      },
    });
  });

  it('should verify the SMTP connection', async () => {
    await service.verifyConnection();

    expect(verifyMock).toHaveBeenCalledTimes(1);
  });

  it('should send an HTML and plain-text email', async () => {
    const payload: IEmailPayload = {
      to: 'recipient@example.com',
      subject: 'Welcome to Collab Docs',
      html: '<h1>Welcome</h1>',
      text: 'Welcome',
    };

    await service.send(payload);

    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'Collab Docs <sender@gmail.com>',
      to: 'recipient@example.com',
      subject: 'Welcome to Collab Docs',
      html: '<h1>Welcome</h1>',
      text: 'Welcome',
    });
  });

  it('should send an email without a plain-text body', async () => {
    const payload: IEmailPayload = {
      to: 'recipient@example.com',
      subject: 'Email verification',
      html: '<p>Verify your email</p>',
    };

    await service.send(payload);

    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'Collab Docs <sender@gmail.com>',
      to: 'recipient@example.com',
      subject: 'Email verification',
      html: '<p>Verify your email</p>',
    });
  });

  it('should propagate SMTP delivery errors', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('SMTP connection failed'));

    await expect(
      service.send({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      }),
    ).rejects.toThrow('SMTP connection failed');
  });

  it('should not prevent startup when SMTP verification fails', async () => {
    verifyMock.mockRejectedValueOnce(new Error('SMTP temporarily unavailable'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
