import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailOutboxEntity } from './email.entity';
import { EmailOutboxService } from './email-outbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailOutboxEntity])],
  providers: [EmailOutboxService],
  exports: [TypeOrmModule, EmailOutboxService],
})
export class EmailOutboxModule {}
