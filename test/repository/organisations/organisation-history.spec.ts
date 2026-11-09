import { DataSource, In, Repository } from 'typeorm';

import { OrganisationEntity } from '@/organisations/organisations.entity';
import { createTestingModule } from '@/test/fixtures/create-testing-module';
import { UserEntity } from '@/user/user.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import {
  OrganisationMembershipStatusEnum,
  RoleEnum,
  RoleScopeEnum,
} from '@/database/database.enums';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { OrganisationsService } from '@/organisations/organisation.service';
import { RoleEntity } from '@/roles/roles.entity';
import { TestingModule } from '@nestjs/testing';

describe('OrganisationsService - Ownership Transfer Rollback', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let orgRepository: Repository<OrganisationEntity>;
  let userRepository: Repository<UserEntity>;
  let organisationsService: OrganisationsService;
  let roleRepository: Repository<RoleEntity>;
  let membershipRepo: Repository<OrganisationMembershipEntity>;

  const userIds: string[] = [];
  const memberIds: string[] = [];
  const roleIds: string[] = [];
  const organisationIds: string[] = [];

  const uniqueId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  beforeAll(async () => {
    const testing = await createTestingModule();
    module = testing.module;

    dataSource = testing.dataSource;
    orgRepository = dataSource.getRepository(OrganisationEntity);
    userRepository = dataSource.getRepository(UserEntity);
    organisationsService =
      testing.module.get<OrganisationsService>(OrganisationsService);
    roleRepository = dataSource.getRepository(RoleEntity);
    membershipRepo = dataSource.getRepository(OrganisationMembershipEntity);
  });

  afterEach(async () => {
    if (memberIds.length) {
      await membershipRepo.delete({ id: In([...memberIds]) });
      memberIds.length = 0;
    }

    if (organisationIds.length) {
      await orgRepository.delete({ id: In([...organisationIds]) });
      organisationIds.length = 0;
    }

    if (userIds.length) {
      await userRepository.delete({ id: In([...userIds]) });
      userIds.length = 0;
    }

    if (roleIds.length) {
      await roleRepository.delete({ id: In([...roleIds]) });
      roleIds.length = 0;
    }
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  it('should roll back owner update if saving ownership history fails midway', async () => {
    const owner = userRepository.create({
      email: `${uniqueId()}@collabdocs.com`,
    });
    const newOwner = userRepository.create({
      email: `${uniqueId()}@collabdocs.com`,
    });
    await userRepository.save([owner, newOwner]);
    userIds.concat([owner.id, newOwner.id]);

    const org = orgRepository.create({
      name: `Rollback ${uniqueId()} Test Org`,
      slug: `rollback-org${Date.now()}`,
      owner: owner,
      creator: owner,
      email: `test-${uniqueId()}@collabdocs.com`,
    });
    await orgRepository.save(org);

    organisationIds.push(org?.id ?? '');

    let role = await roleRepository.findOne({
      where: {
        name: RoleEnum.ORG_ADMIN,
      },
    });

    if (!role) {
      role = await roleRepository.save(
        roleRepository.create({
          name: RoleEnum.ORG_ADMIN,
          scope: RoleScopeEnum.ORGANISATION,
        }),
      );
    }

    roleIds.push(role.id);

    const member = await membershipRepo.save(
      membershipRepo.create({
        user: newOwner,
        organisation: org,
        status: OrganisationMembershipStatusEnum.ACTIVE,
        role,
      }),
    );

    memberIds.push(member.id);

    // Mock the DataSource transaction manager to throw an error
    // *after* the organisation owner is updated, simulating a failure when saving history.
    const originalTransaction = dataSource.transaction.bind(dataSource);
    jest
      .spyOn(dataSource, 'transaction')
      .mockImplementation(async (runInTransaction: any) => {
        return originalTransaction(async (manager) => {
          // Spy on manager.save to intercept OrganisationOwnershipHistoryEntity save and crash
          const originalManagerSave = manager.save.bind(manager);
          jest
            .spyOn(manager, 'save')
            .mockImplementation(async (entityOrTarget, maybeEntity) => {
              if (
                entityOrTarget instanceof OrganisationOwnershipHistoryEntity
              ) {
                throw new Error('SIMULATED_DATABASE_FAILURE_MIDWAY');
              }
              return originalManagerSave(entityOrTarget, maybeEntity);
            });

          return runInTransaction(manager);
        });
      });

    // Attempt transfer and expect it to fail
    await expect(
      organisationsService.transferOwnership(org.id, owner.id, newOwner.id),
    ).rejects.toThrow('SIMULATED_DATABASE_FAILURE_MIDWAY');

    // Check that the organisation's owner is STILL the original owner
    const reloadedOrg = await orgRepository.findOne({
      where: { id: org.id },
      relations: { owner: true },
    });

    expect(reloadedOrg?.owner.id).toEqual(owner.id);
    expect(reloadedOrg?.owner.id).not.toEqual(newOwner.id);
  });
});
