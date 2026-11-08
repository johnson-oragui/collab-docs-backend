import {
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  Column,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

@Index(['id', 'isDeleted'], { unique: false, type: 'btree' })
export abstract class CustomBaseEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    utc: true,
  })
  declare createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    utc: true,
  })
  declare updatedAt: Date;

  @Column({ nullable: false, default: false, type: 'boolean' })
  declare isDeleted: boolean;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }
}
