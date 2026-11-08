import { DataSource, Repository } from 'typeorm';

import { OrganisationEntity } from '@/organisations/organisations.entity';
import { createTestingModule } from '@/test/fixtures/create-testing-module';
import { UserEntity } from '@/user/user.entity';

describe('Organisation Entities Integration Tests', () => {
  let dataSource: DataSource;

  let organisationRepository: Repository<OrganisationEntity>;
  let userRepository: Repository<UserEntity>;
  beforeAll(async () => {
    const testing = await createTestingModule();

    dataSource = testing.dataSource;

    organisationRepository = dataSource.getRepository(OrganisationEntity);
    userRepository = dataSource.getRepository(UserEntity);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await dataSource.destroy();
  });
  describe('OrganisationEntity', () => {
    it('should create and retrieve an organisation', async () => {
      const user = await userRepository.save(
        userRepository.create({
          email: `user-imi98@collabdocs.com`,
          firstName: 'John',
          lastName: 'Doe',
        }),
      );
      const organisation = await organisationRepository.save(
        organisationRepository.create({
          name: `Acme Corp X2w`,
          slug: `acme-corp-cds`,
          owner: user,
        }),
      );

      const foundOrganisation = await organisationRepository.findOneBy({
        id: organisation.id,
      });

      expect(foundOrganisation).toBeDefined();
      expect(foundOrganisation?.name).toBe(organisation.name);
      expect(foundOrganisation?.slug).toBe(organisation.slug);
    });
  });
});
