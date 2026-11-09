import { DataSource, In, Repository } from 'typeorm';

import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationMembershipInvitationEntity } from '@/org_membership_invitation/entity';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/entity';

import { createOrganisationMembershipFixture } from '@/test/fixtures/organisation-membership.fixture';
import { createTestingModule } from '@/test/fixtures/create-testing-module';
import { TestingModule } from '@nestjs/testing';

describe('Organisation Memberships Entities Integration Tests', () => {
  let dataSource: DataSource;

  let userRepository: Repository<UserEntity>;
  let organisationRepository: Repository<OrganisationEntity>;
  let roleRepository: Repository<RoleEntity>;
  let membershipRepository: Repository<OrganisationMembershipEntity>;
  let invitationRepository: Repository<OrganisationMembershipInvitationEntity>;
  let historyRepository: Repository<OrganisationMembershipSuspensionHistoryEntity>;
  let module: TestingModule;

  const userIds: string[] = [];
  const memberIds: string[] = [];
  const roleIds: string[] = [];
  const organisationIds: string[] = [];
  const historyIds: string[] = [];
  const invitationIds: string[] = [];

  beforeAll(async () => {
    const testing = await createTestingModule();
    module = testing.module;

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

  afterEach(async () => {
    if (historyIds.length) {
      await historyRepository.delete({ id: In([...historyIds]) });
      historyIds.length = 0;
    }
    if (invitationIds.length) {
      await invitationRepository.delete({ id: In([...invitationIds]) });
      invitationIds.length = 0;
    }
    if (memberIds.length) {
      await membershipRepository.delete({ id: In([...memberIds]) });
      memberIds.length = 0;
    }

    if (roleIds.length) {
      await roleRepository.delete({ id: In([...roleIds]) });
      roleIds.length = 0;
    }

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

  describe('OrganisationMembershipSuspensionHistoryEntity', () => {
    it('should create and retrieve a suspension history record', async () => {
      const { membership, organisation, role, user } =
        await createOrganisationMembershipFixture(dataSource);

      const suspendedTill = new Date(Date.now() + 7 * 86400000);

      const history = await historyRepository.save(
        historyRepository.create({
          reason: 'Violation of terms',
          suspendedTill,
          membership,
        }),
      );
      historyIds.push(history.id)

      const foundHistory = await historyRepository.findOne({
        where: { id: history.id },
        relations: {
          membership: true,
        },
      });
      userIds.push(user.id);
      organisationIds.push(organisation.id);
      memberIds.push(membership.id);
      roleIds.push(role.id);

      expect(foundHistory).toBeDefined();
      expect(foundHistory?.reason).toBe('Violation of terms');
      expect(foundHistory?.suspendedTill).toEqual(suspendedTill);
      expect(foundHistory?.suspendedAt).toBeInstanceOf(Date);
      expect(foundHistory?.membership.id).toBe(membership.id);
    });
  });
});
