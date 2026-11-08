import { Module } from '@nestjs/common';
import { CustomJwtService } from './jwt.service';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [CustomJwtService, ConfigService],
  exports: [CustomJwtService],
})
export class CustomJwtModule {}
