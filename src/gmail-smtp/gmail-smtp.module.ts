import { Module } from '@nestjs/common';
import { GmailSmtpService } from './gmail-smtp.service';

@Module({
  providers: [GmailSmtpService],
  exports: [GmailSmtpService],
})
export class GmailSmtpModule {}
