import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

/**
 * Maps to the shared `audit_log` table (partitioned by created_at).
 * Append-only — never update or delete rows.
 */
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id: number;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string;

  @Column({ type: 'uuid', name: 'transporter_id', nullable: true })
  transporterId: string;

  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'varchar', length: 20 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: any;

  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
