import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationApiKeyEntity } from './organisation-api-key.entity';
import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationApiKeyEntity,
      UserEntity,
      OrganisationEntity,
    ]),
  ],
})
export class OrganisationApiKeyModule {}
