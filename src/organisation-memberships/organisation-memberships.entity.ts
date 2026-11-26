import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { UserEntity } from '../user/user.entity';
import { OrganisationEntity } from '../organisations/organisations.entity';
import { RoleEntity } from '../roles/roles.entity';
import {
  OrganisationMembershipStatusEnum,
  type TOrganisationMembershipStatusEnum,
} from '../database/database.enums';
import { OrganisationMembershipSuspensionHistoryEntity } from '../org_membership_suspension_histories/org_membership_suspension_histories.entity';
import { MembershipPermissionEntity } from '@/membership_permissions/membership_permissions.entity';
import { NotificationEntity } from '@/notification/notification.entity';
import { NotificationRecipientEntity } from '@/notification-recipients/notification-recipients.entity';
import { NotificationPreferenceEntity } from '@/notification-preference/notification-preference.entity';

@Entity('collabdocs_organisation_memberships')
@Index(['user', 'organisation'], { unique: true }) // Ensures a user can only belong to an org once
export class OrganisationMembershipEntity extends CustomBaseEntity {
  @Column({
    default: 'PENDING',
    type: 'enum',
    enumName: 'collabdocs_org_membership_status_enum',
    enum: OrganisationMembershipStatusEnum,
  })
  declare status: TOrganisationMembershipStatusEnum;

  @Column({ type: 'timestamptz', utc: true, default: null })
  declare suspendedTill: Date | null;

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  // Foreign keys and relations
  @ManyToOne(() => UserEntity, (user) => user.organisationMemberships, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  declare user: UserEntity;

  @ManyToOne(() => OrganisationEntity, (org) => org.memberships, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'organisation_id' })
  declare organisation: OrganisationEntity;

  // The role is tied directly to the membership
  @ManyToOne(() => RoleEntity, (role) => role.memberships, { nullable: false })
  @JoinColumn({ name: 'role_id' })
  declare role: RoleEntity;

  @OneToMany(
    () => OrganisationMembershipSuspensionHistoryEntity,
    (history) => history.membership,
    { cascade: true },
  )
  declare suspensionHistories: OrganisationMembershipSuspensionHistoryEntity[];

  @OneToMany(
    () => NotificationEntity,
    (createdNotifications) => createdNotifications.createdByMembership,
    { cascade: true },
  )
  declare createdNotifications: NotificationEntity[];

  @OneToMany(
    () => NotificationRecipientEntity,
    (receivedNotifications) => receivedNotifications.membership,
    { cascade: true },
  )
  declare receivedNotifications: NotificationRecipientEntity[];

  @OneToOne(
    () => NotificationPreferenceEntity,
    (notificationPreference) => notificationPreference.membership,
    { cascade: true },
  )
  declare notificationPreference: NotificationPreferenceEntity;

  @OneToMany(
    () => MembershipPermissionEntity,
    (membershipPermission) => membershipPermission.membership,
  )
  declare permissions: MembershipPermissionEntity[];
}
