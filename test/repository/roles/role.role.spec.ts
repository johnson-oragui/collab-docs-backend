import { DataSource, In, Repository } from 'typeorm';

import { createTestingModule } from '@/test/fixtures/create-testing-module';
import { RoleEnum, RoleScopeEnum } from '@/database/database.enums';
import { RoleEntity } from '@/roles/roles.entity';
import { TestingModule } from '@nestjs/testing';

describe('Roles Entities Integration Tests', () => {
  let dataSource: DataSource;
  let module: TestingModule;

  let roleRepository: Repository<RoleEntity>;

  const roleIds: string[] = [];

  beforeAll(async () => {
    const testing = await createTestingModule();
    module = testing.module;

    dataSource = testing.dataSource;

    roleRepository = dataSource.getRepository(RoleEntity);
  });

  afterEach(async () => {
    if (roleIds.length) {
      await roleRepository.delete({ id: In([...roleIds]) });
      roleIds.length = 0;
    }
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
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

      roleIds.push(savedRole.id);

      const foundRole = await roleRepository.findOneBy({
        id: savedRole.id,
      });

      expect(foundRole).toBeDefined();
      expect(foundRole?.name).toBe(RoleEnum.ORG_ADMIN);
      expect(foundRole?.scope).toBe(RoleScopeEnum.ORGANISATION);
    });
  });
});
