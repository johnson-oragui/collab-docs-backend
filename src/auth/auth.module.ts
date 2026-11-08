import { Module } from '@nestjs/common';
import UserModule from '../user/user.module';
import { AuthController } from './auth.controller';

@Module({
  providers: [],
  controllers: [AuthController],
  imports: [UserModule],
})
export class AuthModule {}
