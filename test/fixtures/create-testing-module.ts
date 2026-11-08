import { TestingModule, Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { TestingDatabaseModule } from './testing-database.module';
import { OrganisationsService } from '@/organisations/organisation.service';

export async function createTestingModule(): Promise<{
  module: TestingModule;
  dataSource: DataSource;
}> {
  const module = await Test.createTestingModule({
    imports: [TestingDatabaseModule],
    providers: [OrganisationsService],
  }).compile();

  const dataSource = module.get<DataSource>(DataSource);

  return {
    module,
    dataSource,
  };
}