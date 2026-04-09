import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class BaseOrgEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'org_id' })
  @Index()
  orgId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
