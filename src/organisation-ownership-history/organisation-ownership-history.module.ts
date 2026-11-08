import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationOwnershipHistoryEntity } from './organisation-ownership-history.entity';
import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationsService } from '@/organisations/organisation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationOwnershipHistoryEntity,
      UserEntity,
      OrganisationEntity,
    ]),
  ],
  providers: [OrganisationsService],
  exports:[OrganisationsService]
})
export class OrganisationOwnershipHistoryModule {}
