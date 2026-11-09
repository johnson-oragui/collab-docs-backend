import { DataSource, In, Repository } from 'typeorm';
import { UserEntity } from '@/user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationMembershipInvitationEntity } from '@/org_membership_invitation/entity';
import { OrganisationMembershipSuspensionHistoryEntity } from '@/org_membership_suspension_histories/entity';
import {
  InvitationStatusEnum,
  OrganisationMembershipStatusEnum,
  RoleScopeEnum,
} from '@/database/database.enums';
import { createTestingModule } from '@/test/fixtures/create-testing-module';
import { TestingModule } from '@nestjs/testing';

describe('Organisation Relationships Integration Test', () => {
  let dataSource: DataSource;
  let userRepository: Repository<UserEntity>;
  let orgRepository: Repository<OrganisationEntity>;
  let roleRepository: Repository<RoleEntity>;
  let membershipRepository: Repository<OrganisationMembershipEntity>;
  let module: TestingModule;
  let invitationRepo: Repository<OrganisationMembershipInvitationEntity>;
  let historyRepo: Repository<OrganisationMembershipSuspensionHistoryEntity>;

  const userIds: string[] = [];
  const memberIds: string[] = [];
  const roleIds: string[] = [];
  const organisationIds: string[] = [];
  const invitationIds: string[] = [];
  const historyIds: string[] = [];

  const uniqueId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  beforeAll(async () => {
    const testing = await createTestingModule();

    module = testing.module;

    dataSource = testing.dataSource;
    userRepository = dataSource.getRepository(UserEntity);
    orgRepository = dataSource.getRepository(OrganisationEntity);
    roleRepository = dataSource.getRepository(RoleEntity);
    membershipRepository = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
    invitationRepo = dataSource.getRepository(
      OrganisationMembershipInvitationEntity,
    );
    historyRepo = dataSource.getRepository(
      OrganisationMembershipSuspensionHistoryEntity,
    );
  });

  afterEach(async () => {
    if (invitationIds.length) {
      await invitationRepo.delete({ id: In([...invitationIds]) });
      invitationIds.length = 0;
    }
    if (historyIds.length) {
      await historyRepo.delete({ id: In([...historyIds]) });
      historyIds.length = 0;
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
      await orgRepository.delete({ id: In([...organisationIds]) });
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

  it('should successfully create and load complete organisation membership relationships', async () => {
    // Create a User
    const user = userRepository.create({
      email: `${uniqueId()}@collabdocs.com`,
      firstName: 'John',
      lastName: 'Doe',
    });
    await userRepository.save(user);

    // Create an Organisation
    const org = orgRepository.create({
      name: `Johnson ${uniqueId()} Corp`,
      slug: `Johnson-corp ${uniqueId()}`,
      owner: user,
      creator: user,
      email: `test-${uniqueId()}@collabdocs.com`,
    });
    await orgRepository.save(org);

    // Create a Role
    const role =
      (await roleRepository.findOne({
        where: { name: 'ORG_ADMIN', scope: RoleScopeEnum.ORGANISATION },
      })) ??
      (await roleRepository.save(
        roleRepository.create({
          name: 'ORG_ADMIN',
          scope: RoleScopeEnum.ORGANISATION,
        }),
      ));

    const membership = membershipRepository.create({
      user,
      organisation: org,
      role,
      status: OrganisationMembershipStatusEnum.ACTIVE,
    });
    await membershipRepository.save(membership);
    memberIds.push(membership.id)

    const invitation = invitationRepo.create({
      token: `secret-invite-token-123${uniqueId()}`,
      expiresAt: new Date(Date.now() + 86400000), // +1 day
      status: InvitationStatusEnum.PENDING,
      membership,
    });
    await invitationRepo.save(invitation);

    // Add Suspension History to the membership

    const history = historyRepo.create({
      reason: 'Violation of terms',
      membership,
      suspendedTill: new Date(Date.now() + 7 * 86400000),
    });
    await historyRepo.save(history);

    roleIds.push(role.id);
    userIds.push(user.id);
    organisationIds.push(org.id);
    memberIds.push(membership.id);
    invitationIds.push(invitation.id);
    historyIds.push(history.id);

    const loadedMembership = await membershipRepository.findOne({
      where: { id: membership.id },
      relations: {
        user: true,
        organisation: true,
        role: true,
        invitations: true,
        suspensionHistories: true,
      },
    });

    expect(loadedMembership).toBeDefined();
    expect(loadedMembership?.organisation.name).toBe(org.name);
    expect(loadedMembership?.role.name).toEqual('ORG_ADMIN');
    expect(loadedMembership?.invitations).toHaveLength(1);
    expect(loadedMembership?.invitations[0].token).toEqual(invitation.token);
    expect(loadedMembership?.suspensionHistories).toHaveLength(1);
    expect(loadedMembership?.suspensionHistories[0].reason).toEqual(
      'Violation of terms',
    );
  });
});
