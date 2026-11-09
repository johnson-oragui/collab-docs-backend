import {
  Entity,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { OrganisationMembershipEntity } from '../organisation-memberships/organisation-memberships.entity';
import { UserEntity } from '@/user/user.entity';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';
import { OrganisationApiKeyEntity } from '@/organisation-api-key/organisation-api-key.entity';
import {
  OrganisationStatusEnum,
  type TOrganisationStatusEnum,
} from '@/database/database.enums';

@Entity('collabdocs_organisations')
export class OrganisationEntity extends CustomBaseEntity {
  @Column({ unique: true })
  declare name: string;

  @Column({
    type: 'enum',
    enum: OrganisationStatusEnum,
    default: OrganisationStatusEnum.ACTIVE,
  })
  declare status: TOrganisationStatusEnum;

  @Column({ unique: true })
  declare slug: string;

  @Column({ unique: true })
  declare email: string;

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

  @OneToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creator_id' })
  declare creator: UserEntity;

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
