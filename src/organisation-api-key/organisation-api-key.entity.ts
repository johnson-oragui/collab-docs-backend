import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { UserEntity } from '../user/user.entity';
import { OrganisationEntity } from '../organisations/organisations.entity';
import {
  OrganisationApiKeyStatusEnum,
  type TOrganisationApiKeyStatusEnum,
} from '@/database/database.enums';

@Entity('collabdocs_api_keys')
export class OrganisationApiKeyEntity extends CustomBaseEntity {
  @Column()
  declare name: string; // e.g., "CI/CD Pipeline Key"

  @Column({ unique: true, name: 'key_hash' })
  declare keyHash: string; // Hashed secret (e.g., via Argon2 or Bcrypt)

  @Column({ length: 10 })
  @Index()
  declare prefix: string; // First 8-10 chars for display (e.g., "cd_live_9x")

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @Column({
    default: OrganisationApiKeyStatusEnum.ACTIVE,
    type: 'enum',
    enum: OrganisationApiKeyStatusEnum,
  })
  declare status: TOrganisationApiKeyStatusEnum;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  declare expiresAt: Date | null;

  @Column({ type: 'timestamptz', name: 'last_used_at', nullable: true })
  declare lastUsedAt: Date | null;

  @Column({ type: 'simple-array', nullable: true, name: 'allowed_ips' })
  declare allowedIps: string[] | null;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  declare user: UserEntity;

  @ManyToOne(() => OrganisationEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  declare organisation: OrganisationEntity | null;
}
