import { DataSource, Repository } from 'typeorm';

import { UserEntity } from '@/user/user.entity';
import { createTestingModule } from '@/test/fixtures/create-testing-module';

describe('User Entities Integration Tests', () => {
  let dataSource: DataSource;

  let userRepository: Repository<UserEntity>;

  const uniqueId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  beforeAll(async () => {
    const testing = await createTestingModule();

    dataSource = testing.dataSource;

    userRepository = dataSource.getRepository(UserEntity);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await dataSource.destroy();
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

      expect(foundUser).toBeDefined();
      expect(foundUser?.email).toBe(user.email);
      expect(foundUser?.firstName).toBe('John');
      expect(foundUser?.lastName).toBe('Doe');
    });
  });
});