import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Read-only reference to `public.organizations`. Owned by gt-organization-service.
 * Note: the actual org id IS the table's `id` column — there is no separate
 * `org_id` column in this service's schema. `company` is the authoritative
 * organization display name (the legacy `client_name` column was dropped).
 */
@Entity({ name: 'organizations', schema: 'public' })
export class OrganizationRef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  company: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber: string | null;
}
