import { CustomBaseEntity } from '@/database/base.entity';
import { UserEntity } from '@/user/user.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('collabdocs_password_reset_tokens')
@Index('uq_password_reset_tokens_token_hash', ['tokenHash'], {
  unique: true,
})
@Index('idx_password_reset_tokens_user_id', ['user'])
@Index('idx_password_reset_tokens_user_status', ['user', 'usedAt', 'revokedAt'])
@Index('idx_password_reset_tokens_expires_at', ['expiresAt'])
export class PasswordResetTokenEntity extends CustomBaseEntity {
  @ManyToOne(() => UserEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  declare user: UserEntity;

  @Column({
    name: 'token_hash',
    type: 'varchar',
    length: 64,
  })
  declare tokenHash: string;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
  })
  declare expiresAt: Date;

  @Column({
    name: 'used_at',
    nullable: true,
    type: 'timestamptz',
  })
  declare usedAt: Date | null;

  @Column({
    name: 'revoked_at',
    nullable: true,
    type: 'timestamptz',
  })
  declare revokedAt: Date | null;

  @Column({
    name: 'requested_from_ip',
    nullable: true,
    type: 'varchar',
    length: 45,
  })
  declare requestedFromIp: string | null;
}
