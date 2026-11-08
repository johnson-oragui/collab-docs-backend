import { DataSource, Repository } from 'typeorm';

import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationMembershipInvitationEntity } from '@/org_membership_invitation/entity';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/entity';

import { createOrganisationMembershipFixture } from '@/test/fixtures/organisation-membership.fixture';
import { createTestingModule } from '@/test/fixtures/create-testing-module';

describe('Organisation Memberships Entities Integration Tests', () => {
  let dataSource: DataSource;

  let userRepository: Repository<UserEntity>;
  let organisationRepository: Repository<OrganisationEntity>;
  let roleRepository: Repository<RoleEntity>;
  let membershipRepository: Repository<OrganisationMembershipEntity>;
  let invitationRepository: Repository<OrganisationMembershipInvitationEntity>;
  let historyRepository: Repository<OrganisationMembershipSuspensionHistoryEntity>;


  beforeAll(async () => {
    const testing = await createTestingModule();

    dataSource = testing.dataSource;

    userRepository = dataSource.getRepository(UserEntity);
    organisationRepository = dataSource.getRepository(OrganisationEntity);
    roleRepository = dataSource.getRepository(RoleEntity);
    membershipRepository = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
    invitationRepository = dataSource.getRepository(
      OrganisationMembershipInvitationEntity,
    );
    historyRepository = dataSource.getRepository(
      OrganisationMembershipSuspensionHistoryEntity,
    );
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await dataSource.destroy();
  });

  describe('OrganisationMembershipSuspensionHistoryEntity', () => {
    it('should create and retrieve a suspension history record', async () => {
      const { membership } =
        await createOrganisationMembershipFixture(dataSource);

      const suspendedTill = new Date(Date.now() + 7 * 86400000);

      const history = await historyRepository.save(
        historyRepository.create({
          reason: 'Violation of terms',
          suspendedTill,
          membership,
        }),
      );

      const foundHistory = await historyRepository.findOne({
        where: { id: history.id },
        relations: {
          membership: true,
        },
      });

      expect(foundHistory).toBeDefined();
      expect(foundHistory?.reason).toBe('Violation of terms');
      expect(foundHistory?.suspendedTill).toEqual(suspendedTill);
      expect(foundHistory?.suspendedAt).toBeInstanceOf(Date);
      expect(foundHistory?.membership.id).toBe(membership.id);
    });
  });
});
