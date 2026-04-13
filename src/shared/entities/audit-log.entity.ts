import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'org_id' })
  @Index()
  orgId: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id', nullable: true })
  entityId: string;

  @Column({ type: 'jsonb', name: 'old_value', nullable: true })
  oldValue: any;

  @Column({ type: 'jsonb', name: 'new_value', nullable: true })
  newValue: any;

  @Column({ type: 'inet', name: 'ip_address', nullable: true })
  ipAddress: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  @Index()
  createdAt: Date;
}
