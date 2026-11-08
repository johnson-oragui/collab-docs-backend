import { DataSource, Repository } from 'typeorm';
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

describe('Organisation Relationships Integration Test', () => {
  let dataSource: DataSource;
  let userRepository: Repository<UserEntity>;
  let orgRepository: Repository<OrganisationEntity>;
  let roleRepository: Repository<RoleEntity>;
  let membershipRepository: Repository<OrganisationMembershipEntity>;

  beforeAll(async () => {
    const testing = await createTestingModule();

    dataSource = testing.dataSource;
    userRepository = dataSource.getRepository(UserEntity);
    orgRepository = dataSource.getRepository(OrganisationEntity);
    roleRepository = dataSource.getRepository(RoleEntity);
    membershipRepository = dataSource.getRepository(
      OrganisationMembershipEntity,
    );
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await dataSource.destroy();
  });

  it('should successfully create and load complete organisation membership relationships', async () => {
    // Create a User
    const user = userRepository.create({
      email: 'test@collabdocs.com',
      firstName: 'John',
      lastName: 'Doe',
    });
    await userRepository.save(user);

    // Create an Organisation
    const org = orgRepository.create({
      name: 'Acme Corp',
      slug: 'acme-corp',
      owner: user,
    });
    await orgRepository.save(org);

    // Create a Role
    const role = roleRepository.create({
      name: 'ORG_ADMIN',
      scope: RoleScopeEnum.ORGANISATION,
    });
    await roleRepository.save(role);

    // Create Membership linking User, Organisation, and Role
    const membership = membershipRepository.create({
      user,
      organisation: org,
      role,
      status: OrganisationMembershipStatusEnum.ACTIVE,
    });
    await membershipRepository.save(membership);

    // Add an Invitation to the membership
    const invitationRepo = dataSource.getRepository(
      OrganisationMembershipInvitationEntity,
    );
    const invitation = invitationRepo.create({
      token: 'secret-invite-token-123',
      expiresAt: new Date(Date.now() + 86400000), // +1 day
      status: InvitationStatusEnum.PENDING,
      membership,
    });
    await invitationRepo.save(invitation);

    // Add Suspension History to the membership
    const historyRepo = dataSource.getRepository(
      OrganisationMembershipSuspensionHistoryEntity,
    );
    const history = historyRepo.create({
      reason: 'Violation of terms',
      membership,
      suspendedTill: new Date(Date.now() + 7 * 86400000),
    });
    await historyRepo.save(history);

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
    expect(loadedMembership?.user.email).toEqual('test@collabdocs.com');
    expect(loadedMembership?.organisation.name).toEqual('Acme Corp');
    expect(loadedMembership?.role.name).toEqual('ORG_ADMIN');
    expect(loadedMembership?.invitations).toHaveLength(1);
    expect(loadedMembership?.invitations[0].token).toEqual(
      'secret-invite-token-123',
    );
    expect(loadedMembership?.suspensionHistories).toHaveLength(1);
    expect(loadedMembership?.suspensionHistories[0].reason).toEqual(
      'Violation of terms',
    );
  });
});
