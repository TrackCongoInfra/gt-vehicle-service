import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Read-only ref to gt-organization-service's `organization_settings` table.
 *
 * Lives in the same Postgres DB (trackcongo_db). This service uses it to
 * enforce the `resource_quotas.maxDrivers` cap on vehicle creation.
 * `synchronize: false` because gt-organization-service owns the table.
 *
 * Only the column this service reads is declared.
 */
@Entity({ name: 'organization_settings', schema: 'public', synchronize: false })
export class OrganizationSettingsRef {
  @PrimaryColumn({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'resource_quotas', type: 'jsonb' })
  resourceQuotas!: {
    maxUsers?: number;
    maxGeofences?: number;
    maxDrivers?: number;
    maxDevices?: number;
  };

  @Column({ name: 'vehicle_defaults', type: 'jsonb', default: () => `'{}'::jsonb` })
  vehicleDefaults!: {
    speedLimitKmh?: number;
    idleTimeoutMin?: number;
    geofenceAlertEnabled?: boolean;
    harshDrivingEnabled?: boolean;
  };

  @Column({ name: 'custom_fields', type: 'jsonb', default: () => `'[]'::jsonb` })
  customFields!: Array<{
    id: string;
    fieldName: string;
    fieldType: 'string' | 'number' | 'boolean' | 'date' | 'enum';
    required: boolean;
    scope: 'vehicle' | 'user' | 'trip';
    enumOptions?: string[];
  }>;

  @Column({ name: 'maintenance_mode', type: 'jsonb', default: () => `'{}'::jsonb` })
  maintenanceMode!: {
    enabled?: boolean;
    reason?: string | null;
    startedAt?: string | null;
    suppressAlerts?: boolean;
    allowReads?: boolean;
  };
}
