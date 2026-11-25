import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationOwnershipHistoryEntity } from './organisation-ownership-history.entity';
import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OwnershipHistoryService } from './organisation-ownership-history.service';
import { OwnershipHistoryController } from './organisation-ownership-history.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganisationOwnershipHistoryEntity,
      UserEntity,
      OrganisationEntity,
    ]),
  ],
  controllers: [OwnershipHistoryController],
  providers: [OwnershipHistoryService],
})
export class OrganisationOwnershipHistoryModule {}
