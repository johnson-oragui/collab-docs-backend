import { DataSource, In, Repository } from 'typeorm';

import { UserEntity } from '@/user/user.entity';
import { createTestingModule } from '@/test/fixtures/create-testing-module';
import { TestingModule } from '@nestjs/testing';

describe('User Entities Integration Tests', () => {
  let dataSource: DataSource;
  let module: TestingModule;

  let userRepository: Repository<UserEntity>;

  const userIds: string[] = [];

  const uniqueId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  beforeAll(async () => {
    const testing = await createTestingModule();
    dataSource = testing.dataSource;

    module = testing.module;

    userRepository = dataSource.getRepository(UserEntity);
  });

  afterEach(async () => {
    if (userIds.length) {
      await userRepository.delete({ id: In([...userIds]) });
      userIds.length = 0;
    }
  });

  afterAll(async () => {
    await dataSource.destroy();

    await module.close();
  });
  describe('UserEntity', () => {
    it('should create and retrieve a user', async () => {
      const id = uniqueId();

      const user = await userRepository.save(
        userRepository.create({
          email: `user-${id}@collabdocs.com`,
          firstName: 'John',
          lastName: 'Doe',
        }),
      );

      const foundUser = await userRepository.findOneBy({
        id: user.id,
      });
      userIds.push(foundUser?.id ?? '');

      expect(foundUser).toBeDefined();
      expect(foundUser?.email).toBe(user.email);
      expect(foundUser?.firstName).toBe('John');
      expect(foundUser?.lastName).toBe('Doe');
    });
  });
});
