import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { OrganisationMembershipEntity } from '../organisation-memberships/organisation-memberships.entity';
import { UserEntity } from '@/user/user.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { OrganisationApiKeyEntity } from '@/organisation-api-key/organisation-api-key.entity';

@Entity('collabdocs_organisations')
export class OrganisationEntity extends CustomBaseEntity {
  @Column({ unique: true })
  declare name: string;

  @Column({ unique: true })
  declare slug: string;

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @Column({ nullable: true })
  declare description: string;

  // Relations
  @OneToMany(
    () => OrganisationMembershipEntity,
    (membership) => membership.organisation,
    { cascade: true },
  )
  declare memberships: OrganisationMembershipEntity[];

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id' })
  declare owner: UserEntity;

  @OneToMany(
    () => OrganisationOwnershipHistoryEntity,
    (history) => history.organisation,
    { cascade: true },
  )
  declare ownershipHistories: OrganisationOwnershipHistoryEntity[];

  @OneToMany(
    () => OrganisationApiKeyEntity,
    (organisationApiKey) => organisationApiKey.organisation,
    { cascade: true },
  )
  declare organisationApiKeys: OrganisationApiKeyEntity[];
}
