import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { UserEntity } from '@/user/user.entity';
import { type TOrganisationAuditEventEnum } from '@/commons/enums';


@Entity('collabdocs_organisation_audits')
@Index(['organisation', 'createdAt'])
export class OrganisationAuditEntity extends CustomBaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    name: 'event_type',
  })
  declare eventType: TOrganisationAuditEventEnum;

  @Column({ type: 'jsonb', nullable: true })
  declare metadata: Record<string, any> | null;

  @ManyToOne(() => OrganisationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  declare organisation: OrganisationEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  declare actor: UserEntity | null;
}
