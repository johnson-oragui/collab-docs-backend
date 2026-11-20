import { Global, Module } from '@nestjs/common';
import { CustomJwtService } from './jwt.service';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [CustomJwtService, ConfigService],
  exports: [CustomJwtService],
})
export class CustomJwtModule {}
