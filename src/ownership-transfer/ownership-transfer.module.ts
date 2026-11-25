import { Module } from '@nestjs/common';
import { OwnershipTransferController } from './ownership-transfer.controller';
import { OwnershipTransferService } from './ownership-transfer.service';
import { RedisModule } from '@/redis/redis.module';
import { EmailOutboxModule } from '@/email-outbox/email-outbox.module';

@Module({
  controllers: [OwnershipTransferController],
  providers: [OwnershipTransferService],
  imports: [RedisModule, EmailOutboxModule],
})
export class OwnershipTransferModule {}
