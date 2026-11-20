import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationAuditEntity } from './organisation_audit.entity';
// import { OrganisationAuditController } from './organisation_audit.controller';
// import { OrganisationAuditService } from './organisation_audit.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OrganisationAuditEntity])],
  exports: [TypeOrmModule],
  // controllers: [OrganisationAuditController],
  // providers: [OrganisationAuditService],
})
export class OrganisationAuditModule {}
