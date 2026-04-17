import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Read-only reference to `public.users`. Owned by gt-user-service.
 * Used to expose the assigned user's identity on the vehicle GET response.
 * Only non-sensitive fields are declared — password, verification tokens,
 * etc. are never read here.
 */
@Entity({ name: 'users', schema: 'public' })
export class UserRef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  username: string | null;

  @Column({ name: 'phone_number', type: 'varchar', length: 20, nullable: true })
  phoneNumber: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_org_admin', type: 'boolean', default: false })
  isOrgAdmin: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
