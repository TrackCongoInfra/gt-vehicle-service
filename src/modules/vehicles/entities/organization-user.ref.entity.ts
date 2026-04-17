import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Read-only reference to `public.organization_users`.
 * Owned by gt-organization-service. Holds the subscription + billing
 * details for each user within an organization — we read from it here to
 * enrich the vehicle GET response with subscriptionStart / subscriptionDue /
 * autoRenewal derived from `billing_detail` jsonb.
 */
@Entity({ name: 'organization_users', schema: 'public' })
export class OrganizationUserRef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  role: string;

  @Column({ type: 'text', default: 'active' })
  status: string;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ name: 'owner_username', type: 'varchar', length: 100, nullable: true })
  ownerUsername: string | null;

  @Column({ name: 'subscription_start_date', type: 'date', nullable: true })
  subscriptionStartDate: string | null;

  @Column({ name: 'subscription_due_date', type: 'date', nullable: true })
  subscriptionDueDate: string | null;

  @Column({ name: 'subscription_extended_date', type: 'date', nullable: true })
  subscriptionExtendedDate: string | null;

  @Column({
    name: 'subscription_overwrite_all_vehicles',
    type: 'boolean',
    default: false,
  })
  subscriptionOverwriteAllVehicles: boolean;

  @Column({ name: 'billing_detail', type: 'jsonb', default: () => "'{}'" })
  billingDetail: Record<string, unknown>;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
