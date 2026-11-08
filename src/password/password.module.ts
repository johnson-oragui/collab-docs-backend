import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [PasswordService, ConfigService],
  exports: [PasswordService],
})
export class PasswordModule {}
