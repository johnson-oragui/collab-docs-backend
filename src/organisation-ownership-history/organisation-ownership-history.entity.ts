import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CustomBaseEntity } from '../database/base.entity';
import { UserEntity } from '../user/user.entity';
import { OrganisationEntity } from '@/organisations/organisations.entity';

@Entity('collabdocs_organisation_ownership_histories')
export class OrganisationOwnershipHistoryEntity extends CustomBaseEntity {
  @ManyToOne(() => OrganisationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  declare organisation: OrganisationEntity;

  @Column({ nullable: true, type: 'uuid' })
  declare requestId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'previous_owner_id' })
  declare previousOwner: UserEntity | null; // nullable because the very first creation has no previous owner

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'new_owner_id' })
  declare newOwner: UserEntity;

  @Column({
    type: 'timestamptz',
    name: 'transferred_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  declare transferredAt: Date;

  @Column({ type: 'text', nullable: true })
  declare reason: string | null;
}
