import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from './profile.entity';
import { UserEntity } from '@/user/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProfileEntity, UserEntity]),
  ],
})
export class ProfileModule {}
