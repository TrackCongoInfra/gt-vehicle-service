import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Read-only reference to `public.organizations`. Owned by gt-organization-service.
 * Display name is now `org_name` (formerly `company` / `client_name`).
 */
@Entity({ name: 'organizations', schema: 'public' })
export class OrganizationRef {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'org_name', type: 'varchar', nullable: true })
  orgName: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber: string | null;
}
