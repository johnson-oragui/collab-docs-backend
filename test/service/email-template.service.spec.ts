import { EmailTemplateService } from '@/email/email-template.service';

describe('Test EmailTemplateService', () => {
  let service: EmailTemplateService;

  const options = {
    recipientEmail: 'johnson@example.com',
    recipientName: 'Johnson',
    actionUrl: 'https://collabdocs.com/password-reset?token=test-token',
    expiresIn: '30 minutes',
  };

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  describe('createPasswordResetEmail', () => {
    it('should generate a password reset email', () => {
      const result = service.createPasswordResetEmail(options);

      expect(result.to).toBe(options.recipientEmail);
      expect(result.subject).toBe('Reset your Collab Docs password');
      expect(result.html).toContain('Reset Password');
      expect(result.html).toContain(options.actionUrl);
      expect(result.text).toContain(options.actionUrl);
      expect(result.text).toContain(options.expiresIn);
    });
  });

  describe('createEmailVerificationEmail', () => {
    it('should generate an email verification email', () => {
      const result = service.createEmailVerificationEmail(options);

      expect(result.to).toBe(options.recipientEmail);
      expect(result.subject).toBe('Verify your Collab Docs email address');
      expect(result.html).toContain('Verify Email Address');
      expect(result.html).toContain(options.actionUrl);
      expect(result.text).toContain(options.actionUrl);
    });
  });

  it('should escape HTML in recipient names', () => {
    const result = service.createPasswordResetEmail({
      ...options,
      recipientName: '<script>alert("xss")</script>',
    });

    expect(result.html).not.toContain('<script>alert("xss")</script>');

    expect(result.html).toContain('&lt;script&gt;');
  });

  it('should escape HTML in action URLs', () => {
    const result = service.createPasswordResetEmail({
      ...options,
      actionUrl: 'https://collabdocs.com/password=reset?a=1&b=2',
    });

    expect(result.html).toContain('&amp;b=2');
  });

  it('should support emails without a recipient name', () => {
    const result = service.createPasswordResetEmail({
      ...options,
      recipientName: undefined,
    });

    expect(result.html).toContain('Hello,');
  });
});
