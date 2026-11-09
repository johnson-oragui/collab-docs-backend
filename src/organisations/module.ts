import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationEntity } from './organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationsService } from './organisation.service';
import { OrganisationRepository } from './organisation.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationEntity,
      OrganisationMembershipEntity,
    ]),
  ],
  providers: [OrganisationsService, OrganisationRepository],
  exports: [OrganisationsService, OrganisationRepository],
})
export class OrganisationModule {}
