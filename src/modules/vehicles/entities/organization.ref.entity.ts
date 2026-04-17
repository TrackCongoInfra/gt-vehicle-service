import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Read-only reference to `public.organizations`. Owned by gt-organization-service.
 * Note: the actual org id IS the table's `id` column — there is no separate
 * `org_id` column in this service's schema. We read `company` / `client_name`
 * to resolve the `companyName` field on the enriched vehicle GET response.
 */
@Entity({ name: 'organizations', schema: 'public' })
export class OrganizationRef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_name', type: 'varchar' })
  clientName: string;

  @Column({ type: 'varchar', nullable: true })
  company: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber: string | null;
}
