import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationOwnershipHistoryEntity } from './organisation-ownership-history.entity';
import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationOwnershipHistoryEntity,
      UserEntity,
      OrganisationEntity,
    ]),
  ],
})
export class OrganisationOwnershipHistoryModule {}
