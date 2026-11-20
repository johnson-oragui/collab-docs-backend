import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationApiKeyEntity } from './organisation-api-key.entity';
import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationApiKeysService } from './organisation-api-key.service';
import { PasswordModule } from '@/password/password.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationApiKeyEntity,
      UserEntity,
      OrganisationEntity,
    ]),
    PasswordModule,
  ],
  providers: [OrganisationApiKeysService],
  exports: [OrganisationApiKeysService],
})
export class OrganisationApiKeyModule {}
