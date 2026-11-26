import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailEncryptionService } from './email-encryption.service';
import { EmailOutboxDispatcherService } from './email-outbox-dispatcher.service';
import { EmailOutboxModule } from '@/email-outbox/email-outbox.module';
import { GmailSmtpModule } from '@/gmail-smtp/gmail-smtp.module';
import { EmailTemplateService } from './email-template.service';
import { EmailProcessor } from './email.processor';
import { CustomBullMQModule } from '@/custom-bullmq/custom-bullmq.module';

@Global()
@Module({
  imports: [EmailOutboxModule, CustomBullMQModule, GmailSmtpModule],
  providers: [
    EmailService,
    EmailEncryptionService,
    EmailOutboxDispatcherService,
    EmailTemplateService,
    EmailProcessor,
  ],
  exports: [
    EmailService,
    EmailEncryptionService,
    EmailOutboxDispatcherService,
    EmailTemplateService,
    EmailProcessor,
    EmailTemplateService,
  ],
})
export class EmailModule {}
