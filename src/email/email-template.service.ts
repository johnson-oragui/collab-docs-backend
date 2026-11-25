import { Injectable } from '@nestjs/common';
import {
  IEmailInfoTemplateOptions,
  IEmailPayload,
  IEmailTemplateOptions,
} from './email.interface';

@Injectable()
export class EmailTemplateService {
  private readonly productName = 'Collab Docs';

  /**
   * Escapes user-provided values before inserting them into HTML.
   */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getGreeting(recipientName?: string): string {
    const name = recipientName?.trim();

    return name ? `Hello ${this.escapeHtml(name)},` : 'Hello,';
  }

  private getLayout(content: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${this.productName}</title>
        </head>
        <body style="
          margin: 0;
          padding: 32px 16px;
          background-color: #f4f6f8;
          font-family: Arial, Helvetica, sans-serif;
          color: #1f2937;
        ">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
          >
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    max-width: 560px;
                    background-color: #ffffff;
                    border-radius: 8px;
                    overflow: hidden;
                  "
                >
                  <tr>
                    <td style="padding: 28px 32px;">
                      <h2 style="
                        margin: 0;
                        color: #2563eb;
                        font-size: 22px;
                      ">
                        ${this.productName}
                      </h2>
                    </td>
                  </tr>

                  <tr>
                    <td style="
                      padding: 8px 32px 32px;
                      font-size: 15px;
                      line-height: 1.7;
                    ">
                      ${content}
                    </td>
                  </tr>

                  <tr>
                    <td style="
                      padding: 20px 32px;
                      background-color: #f9fafb;
                      color: #6b7280;
                      font-size: 12px;
                      line-height: 1.6;
                    ">
                      This is an automated message from
                      ${this.productName}. Please do not reply to this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private getActionButton(actionUrl: string, label: string): string {
    const safeUrl = this.escapeHtml(actionUrl);

    return `
      <p style="margin: 28px 0;">
        <a
          href="${safeUrl}"
          style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
          "
        >
          ${label}
        </a>
      </p>
    `;
  }

  createPasswordResetEmail(options: IEmailTemplateOptions): IEmailPayload {
    const greeting = this.getGreeting(options.recipientName);

    const html = this.getLayout(`
      <p>${greeting}</p>

      <p>
        We received a request to reset the password associated
        with your ${this.productName} account.
      </p>

      <p>
        Use the button below to choose a new password.
      </p>

      ${this.getActionButton(options.actionUrl, 'Reset Password')}

      <p>
        This link expires in
        <strong>${this.escapeHtml(options.expiresIn)}</strong>.
      </p>

      <p>
        If you did not request a password reset, you can safely
        ignore this email. Your password will remain unchanged.
      </p>

      <p>
        If the button does not work, copy and paste this link
        into your browser:
      </p>

      <p style="word-break: break-all;">
        ${this.escapeHtml(options.actionUrl)}
      </p>
    `);

    const text = [
      greeting,
      '',
      `We received a request to reset the password associated with your ${this.productName} account.`,
      '',
      `Reset your password using this link: ${options.actionUrl}`,
      '',
      `This link expires in ${options.expiresIn}.`,
      '',
      'If you did not request a password reset, you can safely ignore this email.',
    ].join('\n');

    return {
      to: options.recipientEmail,
      subject: 'Reset your Collab Docs password',
      html,
      text,
    };
  }

  createEmailVerificationEmail(options: IEmailTemplateOptions): IEmailPayload {
    const greeting = this.getGreeting(options.recipientName);

    const html = this.getLayout(`
      <p>${greeting}</p>

      <p>
        Welcome to ${this.productName}!
      </p>

      <p>
        Please verify your email address to activate your account
        and complete your registration.
      </p>

      ${this.getActionButton(options.actionUrl, 'Verify Email Address')}

      <p>
        This link expires in
        <strong>${this.escapeHtml(options.expiresIn)}</strong>.
      </p>

      <p>
        If you did not create a ${this.productName} account,
        you can safely ignore this email.
      </p>

      <p>
        If the button does not work, copy and paste this link
        into your browser:
      </p>

      <p style="word-break: break-all;">
        ${this.escapeHtml(options.actionUrl)}
      </p>
    `);

    const text = [
      greeting,
      '',
      `Welcome to ${this.productName}!`,
      '',
      'Please verify your email address using this link:',
      options.actionUrl,
      '',
      `This link expires in ${options.expiresIn}.`,
      '',
      `If you did not create a ${this.productName} account, you can safely ignore this email.`,
    ].join('\n');

    return {
      to: options.recipientEmail,
      subject: 'Verify your Collab Docs email address',
      html,
      text,
    };
  }

  createOrganisationInvitationEmail(
    options: IEmailTemplateOptions,
  ): IEmailPayload {
    const greeting = this.getGreeting(options.recipientName);

    const html = this.getLayout(`
      <p>${greeting}</p>

      <p>
        You have been invited to ${options.organisationName ?? ''} Organisation.
      </p>

      <p>
        Use the button below to accept/decline Invitation.
      </p>

      ${this.getActionButton(options.actionUrl, 'Reset Password')}

      <p>
        This link expires in
        <strong>${this.escapeHtml(options.expiresIn)}</strong>.
      </p>

      <p>
        If the button does not work, copy and paste this link
        into your browser:
      </p>

      <p style="word-break: break-all;">
        ${this.escapeHtml(options.actionUrl)}
      </p>
    `);

    const text = [
      greeting,
      '',
      `You have been invited to ${options.organisationName ?? ''} Organisation.`,
      '',
      `Accept/Decline using this link: ${options.actionUrl}`,
      '',
      `This link expires in ${options.expiresIn}.`,
      '',
    ].join('\n');

    return {
      to: options.recipientEmail,
      subject: 'Organisation Invitation',
      html,
      text,
    };
  }

  sendOrganisationInfoEmail(options: IEmailInfoTemplateOptions): IEmailPayload {
    try {
      const greeting = this.getGreeting(options.recipientName);

      const html = this.getLayout(`
      <p>${greeting}</p>

      <p>
        We have some information from your ${options.organisationName ?? ''} Organisation.
      </p>

      <p>
        ${options.info}
      </p>
    `);

      const text = [
        greeting,
        '',
        `We have some information from your ${options.organisationName ?? ''} Organisation.`,
        '',
        `${options.info}`,
        '',
        '',
      ].join('\n');

      return {
        to: options.recipientEmail,
        subject: 'Organisation Update',
        html,
        text,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
