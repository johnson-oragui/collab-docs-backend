import { Module } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationController } from './email-verification.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@/user/user.entity';
import { ProfileEntity } from '@/profile/profile.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { PasswordResetTokenEntity } from '@/password-recovery/password-recovery.entity';
import { EmailOutboxModule } from '@/email-outbox/email-outbox.module';

@Module({
  providers: [EmailVerificationService],
  exports: [EmailVerificationService],
  controllers: [EmailVerificationController],
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      ProfileEntity,
      OrganisationMembershipEntity,
      OrganisationEntity,
      PasswordResetTokenEntity,
    ]),
    EmailOutboxModule,
  ],
})
export class EmailVerificationModule {}
