import { Column, Entity, OneToOne } from 'typeorm';
import { UserEntity } from '../user/user.entity';
import { CustomBaseEntity } from '../database/base.entity';

@Entity('collabdocs_profiles')
export class ProfileEntity extends CustomBaseEntity {
  @Column({ nullable: true })
  declare bio?: string;

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @Column({ nullable: true })
  declare avatarUrl?: string;

  @OneToOne(() => UserEntity, (user) => user.profile)
  declare user: UserEntity;
}
