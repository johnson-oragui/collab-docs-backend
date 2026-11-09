import { TestingModule, Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { TestingDatabaseModule } from './testing-database.module';

export async function createSessionTestingModule(): Promise<{
  module: TestingModule;
  dataSource: DataSource;
}> {
  const module = await Test.createTestingModule({
    imports: [TestingDatabaseModule],
  }).compile();

  const dataSource = module.get<DataSource>(DataSource);

  return {
    module,
    dataSource,
  };
}