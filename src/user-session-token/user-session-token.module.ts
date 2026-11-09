import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSessionTokenEntity } from './user-session-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSessionEntity, UserSessionTokenEntity]),
  ],
})
export class UserSessionTokenModule {}
