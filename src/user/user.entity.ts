import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { ProfileEntity } from '../profile/profile.entity';
import { OrganisationMembershipEntity } from '../organisation-memberships/organisation-memberships.entity';
import { OrganisationApiKeyEntity } from '@/organisation-api-key/organisation-api-key.entity';

@Entity('collabdocs_users')
export class UserEntity extends CustomBaseEntity {
  @Column({ unique: true })
  declare email: string;

  @Column({ name: 'first_name', nullable: true })
  declare firstName: string;

  @Column({ name: 'password', nullable: true })
  declare password: string;

  @Column({ name: 'last_name', nullable: true })
  declare lastName: string;
  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @Column({ default: true, name: 'is_active' })
  declare isActive: boolean;

  @Column({ default: true, name: 'accept_terms' })
  declare acceptTerms: boolean;

  // r/ships
  @OneToOne(() => ProfileEntity, (profile) => profile.user, { cascade: true })
  @JoinColumn()
  declare profile: ProfileEntity;

  @OneToMany(
    () => OrganisationMembershipEntity,
    (organisationMembershipEntity) => organisationMembershipEntity.user,
    { cascade: true },
  )
  declare organisationMemberships: OrganisationMembershipEntity[];

  @OneToMany(
    () => OrganisationApiKeyEntity,
    (organisationApiKeyEntity) => organisationApiKeyEntity.user,
    { cascade: true },
  )
  declare organisationApiKeys: OrganisationApiKeyEntity[];
}
