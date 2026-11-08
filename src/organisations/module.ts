import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationEntity } from './organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationEntity,
      OrganisationMembershipEntity,
    ]),
  ],
})
export class OrganisationModule {}
