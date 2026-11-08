import {
  OrganisationMembershipStatusEnum,
  RoleEnum,
  RoleScopeEnum,
} from '@/database/database.enums';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { RoleEntity } from '@/roles/roles.entity';
import { UserEntity } from '@/user/user.entity';
import { DataSource } from 'typeorm';

export async function createOrganisationMembershipFixture(
  dataSource: DataSource,
) {
  const uniqueId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const userRepository = dataSource.getRepository(UserEntity);
  const organisationRepository = dataSource.getRepository(OrganisationEntity);
  const roleRepository = dataSource.getRepository(RoleEntity);
  const membershipRepository = dataSource.getRepository(
    OrganisationMembershipEntity,
  );

  const id = uniqueId();

  const user = await userRepository.save(
    userRepository.create({
      email: `test-${id}@collabdocs.com`,
      firstName: 'John',
      lastName: 'Doe',
    }),
  );

  const organisation = await organisationRepository.save(
    organisationRepository.create({
      name: `Acme Corp ${id}`,
      slug: `acme-corp-${id}`,
      owner: user,
    }),
  );

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

  const membership = await membershipRepository.save(
    membershipRepository.create({
      user,
      organisation,
      role,
      status: OrganisationMembershipStatusEnum.ACTIVE,
    }),
  );

  return { user, organisation, role, membership };
}
