import { DataSource, In, Repository } from 'typeorm';

import { OrganisationEntity } from '@/organisations/organisations.entity';
import { createTestingModule } from '@/test/fixtures/create-testing-module';
import { UserEntity } from '@/user/user.entity';
import { TestingModule } from '@nestjs/testing';

describe('Organisation Entities Integration Tests', () => {
  let dataSource: DataSource;
  let module: TestingModule;

  let organisationRepository: Repository<OrganisationEntity>;
  let userRepository: Repository<UserEntity>;

  const uniqueId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const userIds: string[] = [];
  const organisationIds: string[] = [];
  beforeAll(async () => {
    const testing = await createTestingModule();

    module = testing.module;

    dataSource = testing.dataSource;

    organisationRepository = dataSource.getRepository(OrganisationEntity);
    userRepository = dataSource.getRepository(UserEntity);
  });

  afterEach(async () => {
    if (organisationIds.length) {
      await organisationRepository.delete({ id: In([...organisationIds]) });
      organisationIds.length = 0;
    }

    if (userIds.length) {
      await userRepository.delete({ id: In([...userIds]) });
      userIds.length = 0;
    }
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });
  describe('OrganisationEntity', () => {
    it('should create and retrieve an organisation', async () => {
      const user = await userRepository.save(
        userRepository.create({
          email: `user-imi98${uniqueId()}@collabdocs.com`,
          firstName: 'John',
          lastName: 'Doe',
        }),
      );
      const organisation = await organisationRepository.save(
        organisationRepository.create({
          name: `Acme Corp ${uniqueId()} X2w`,
          slug: `acme-corp-cds-${uniqueId()}`,
          owner: user,
          creator: user,
          email: `test-${uniqueId()}@collabdocs.com`,
        }),
      );
      organisationIds.push(organisation.id);
      userIds.push(user.id);

      const foundOrganisation = await organisationRepository.findOneBy({
        id: organisation.id,
      });

      expect(foundOrganisation).toBeDefined();
      expect(foundOrganisation?.name).toBe(organisation.name);
      expect(foundOrganisation?.slug).toBe(organisation.slug);
    });
  });
});
