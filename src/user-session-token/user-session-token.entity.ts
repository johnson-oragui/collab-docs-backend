import { CustomBaseEntity } from '@/database/base.entity';
import {
  type TUserSessionTokenStatusEnum,
  UserSessionTokenStatusEnum,
} from '@/database/database.enums';
import { UserSessionEntity } from '@/user_sessions/user-session.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('collabdocs_user_session_tokens')
@Index('uq_user_session_tokens_token_hash', ['tokenHash'], {
  unique: true,
})
@Index('idx_user_session_tokens_session_id', ['session'])
@Index('idx_user_session_tokens_session_status', ['session', 'status'])
export class UserSessionTokenEntity extends CustomBaseEntity {
  @ManyToOne(() => UserSessionEntity, (session) => session.tokens, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'session_id' })
  declare session: UserSessionEntity;

  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  declare tokenHash: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: UserSessionTokenStatusEnum,
    enumName: 'collabdocs_user_session_token_status_enum',
    default: UserSessionTokenStatusEnum.ACTIVE,
  })
  declare status: TUserSessionTokenStatusEnum;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  declare expiresAt: Date;

  @Column({ name: 'used_at', nullable: true, type: 'timestamptz' })
  declare usedAt: Date | null;

  @Column({
    name: 'replaced_by_token_id',
    nullable: true,
    type: 'uuid',
  })
  declare replacedByTokenId: string | null;
}
