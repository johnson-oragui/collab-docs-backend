import { CustomBaseEntity } from '@/database/base.entity';
import { UserSessionTokenEntity } from '@/user-session-token/user-session-token.entity';
import { UserEntity } from '@/user/user.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { OrganisationEntity } from '@/organisations/organisations.entity';

@Entity('collabdocs_user_sessions')
@Index('idx_user_sessions_user_id', ['user'])
@Index('idx_user_sessions_user_active', ['user', 'revokedAt', 'expiresAt'])
export class UserSessionEntity extends CustomBaseEntity {
  @ManyToOne(() => UserEntity, (user) => user.sessions, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  declare user: UserEntity;

  @Column({ name: 'device_name', nullable: true, type: 'varchar', length: 255 })
  declare deviceName: string | null;

  @Column({ name: 'user_agent', nullable: true, type: 'text' })
  declare userAgent: string | null;

  @Column({ name: 'ip_address', nullable: true, type: 'varchar', length: 45 })
  declare ipAddress: string | null;

  @Column({ name: 'last_used_at', nullable: true, type: 'timestamptz' })
  declare lastUsedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  declare expiresAt: Date;

  @Column({ name: 'revoked_at', nullable: true, type: 'timestamptz' })
  declare revokedAt: Date | null;

  @Column({
    name: 'revoke_reason',
    nullable: true,
    type: 'varchar',
    length: 100,
  })
  declare revokeReason: string | null;

  @OneToMany(
    () => UserSessionTokenEntity,
    (sessionToken) => sessionToken.session,
  )
  declare tokens: UserSessionTokenEntity[];

  @ManyToOne(() => OrganisationEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'organisation_id' })
  declare organisation: OrganisationEntity;
}
