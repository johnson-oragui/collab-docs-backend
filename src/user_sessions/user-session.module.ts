import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSessionService } from './user-session.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSessionEntity, UserSessionTokenEntity]),
  ],
  providers: [UserSessionService],
  exports: [UserSessionService],
})
export class UserSessionModule {}
