import { DataSource, Repository } from 'typeorm';

import { createTestingModule } from '@/test/fixtures/create-testing-module';
import { RoleEnum, RoleScopeEnum } from '@/database/database.enums';
import { RoleEntity } from '@/roles/roles.entity';

describe('Roles Entities Integration Tests', () => {
  let dataSource: DataSource;

  let roleRepository: Repository<RoleEntity>;

  const uniqueId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  beforeAll(async () => {
    const testing = await createTestingModule();

    dataSource = testing.dataSource;

    roleRepository = dataSource.getRepository(RoleEntity);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await dataSource.destroy();
  });

  describe('RoleEntity', () => {
    it('should create and retrieve an organisation admin role', async () => {
      const role = await roleRepository.findOne({
        where: {
          name: RoleEnum.ORG_ADMIN,
        },
      });

      const savedRole =
        role ??
        (await roleRepository.save(
          roleRepository.create({
            name: RoleEnum.ORG_ADMIN,
            scope: RoleScopeEnum.ORGANISATION,
          }),
        ));

      const foundRole = await roleRepository.findOneBy({
        id: savedRole.id,
      });

      expect(foundRole).toBeDefined();
      expect(foundRole?.name).toBe(RoleEnum.ORG_ADMIN);
      expect(foundRole?.scope).toBe(RoleScopeEnum.ORGANISATION);
    });
  });
});
