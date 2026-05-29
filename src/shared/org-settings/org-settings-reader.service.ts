import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSettingsRef } from './organization-settings-ref.entity';

type QuotaKey = 'maxUsers' | 'maxGeofences' | 'maxDrivers' | 'maxDevices';

interface CachedSettings {
  resourceQuotas: OrganizationSettingsRef['resourceQuotas'];
  vehicleDefaults: OrganizationSettingsRef['vehicleDefaults'];
  customFields: OrganizationSettingsRef['customFields'];
  maintenanceMode: OrganizationSettingsRef['maintenanceMode'];
  cachedAt: number;
}

const TTL_MS = 60_000; // 60s — short so admin changes propagate within a minute
const EMPTY: CachedSettings = {
  resourceQuotas: {},
  vehicleDefaults: {},
  customFields: [],
  maintenanceMode: {},
  cachedAt: 0,
};

/**
 * Reads `organization_settings.resource_quotas` with a per-instance TTL
 * cache. Used by the vehicle-create path to enforce `maxDrivers`.
 *
 * Failure handling: any DB read failure returns null from `getQuota` so a
 * transient DB blip never blocks creates. Surface via warning log only.
 * Settings are a commercial / usability layer, not a security one — failing
 * open is the conscious choice.
 */
@Injectable()
export class OrgSettingsReaderService {
  private readonly logger = new Logger(OrgSettingsReaderService.name);
  private readonly cache = new Map<string, CachedSettings>();

  constructor(
    @InjectRepository(OrganizationSettingsRef)
    private readonly repo: Repository<OrganizationSettingsRef>,
  ) {}

  private async get(orgId: string): Promise<CachedSettings> {
    const hit = this.cache.get(orgId);
    if (hit && Date.now() - hit.cachedAt < TTL_MS) return hit;

    try {
      const row = await this.repo.findOne({ where: { organizationId: orgId } });
      const fresh: CachedSettings = row
        ? {
            resourceQuotas: row.resourceQuotas ?? {},
            vehicleDefaults: row.vehicleDefaults ?? {},
            customFields: row.customFields ?? [],
            maintenanceMode: row.maintenanceMode ?? {},
            cachedAt: Date.now(),
          }
        : { ...EMPTY, cachedAt: Date.now() };
      this.cache.set(orgId, fresh);
      return fresh;
    } catch (err) {
      this.logger.warn(
        `Failed to read org_settings for org=${orgId}: ${
          err instanceof Error ? err.message : String(err)
        } — defaulting to UNLIMITED.`,
      );
      // Don't cache failures — next call retries fresh.
      return EMPTY;
    }
  }

  /**
   * Returns the configured numeric quota for the given resource, or null
   * (UNLIMITED) if the key is missing/undefined or the settings row doesn't
   * exist for this org.
   */
  async getQuota(orgId: string, key: QuotaKey): Promise<number | null> {
    const s = await this.get(orgId);
    const v = s.resourceQuotas?.[key];
    if (v === undefined || v === null) return null;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    return v;
  }

  /**
   * Returns the org's vehicle_defaults blob. Empty object if unset. Used by
   * the create path to fill in fields the caller didn't specify.
   */
  async getVehicleDefaults(orgId: string): Promise<OrganizationSettingsRef['vehicleDefaults']> {
    const s = await this.get(orgId);
    return s.vehicleDefaults ?? {};
  }

  /**
   * Returns the org's custom_fields catalog filtered to the given scope.
   * Empty array if unset. Used to validate user-provided custom_fields
   * payloads at create/update time.
   */
  async getCustomFieldsForScope(
    orgId: string,
    scope: 'vehicle' | 'user' | 'trip',
  ): Promise<OrganizationSettingsRef['customFields']> {
    const s = await this.get(orgId);
    return (s.customFields ?? []).filter((f) => f.scope === scope);
  }

  /**
   * Returns the org's maintenance_mode state. Empty object if unset.
   * Used by the MaintenanceGuard to decide whether to block write methods.
   */
  async getMaintenanceMode(orgId: string): Promise<OrganizationSettingsRef['maintenanceMode']> {
    const s = await this.get(orgId);
    return s.maintenanceMode ?? {};
  }

  /** Drop a single org's cached entry — for future Pub/Sub invalidation hookup. */
  invalidate(orgId: string): void {
    this.cache.delete(orgId);
  }
}
