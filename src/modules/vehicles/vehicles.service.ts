import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, In, IsNull, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Vehicle } from './entities/vehicle.entity';
import { DeviceRef } from './entities/device.ref.entity';
import { OrganizationUserRef } from './entities/organization-user.ref.entity';
import { UserRef } from './entities/user.ref.entity';
import { OrganizationRef } from './entities/organization.ref.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { FilterVehicleDto } from './dto/filter-vehicle.dto';
import { AuditLog } from '../../shared/entities/audit-log.entity';
import {
  EnrichedVehicleRow,
  mapVehicleToResponse,
} from './mappers/vehicle-response.mapper';
import { OrgSettingsReaderService } from '../../shared/org-settings/org-settings-reader.service';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(DeviceRef)
    private readonly deviceRepo: Repository<DeviceRef>,
    @InjectRepository(OrganizationUserRef)
    private readonly orgUserRepo: Repository<OrganizationUserRef>,
    @InjectRepository(UserRef)
    private readonly userRepo: Repository<UserRef>,
    @InjectRepository(OrganizationRef)
    private readonly organizationRepo: Repository<OrganizationRef>,
    private readonly orgSettings: OrgSettingsReaderService,
  ) {}

  /**
   * Enforces `organization_settings.resource_quotas.maxDrivers` cap before a
   * new vehicle is inserted. Quota = null/undefined means UNLIMITED.
   *
   * Drivers in this service are represented by the `operator` column on
   * vehicles — a freeform driver-name string. There is no first-class
   * `drivers` table owned by this service, so the cap is applied only when
   * the new vehicle would actually carry an operator (i.e. dto.operator is
   * a non-empty string), and the count is the number of distinct operator
   * names already in use across the org's non-deleted vehicles.
   *
   * Vehicles created without an operator do not count against the quota and
   * are not blocked.
   *
   * Race-window of one is acceptable per product spec; tightening requires
   * advisory locks.
   */
  private async assertDriverQuota(
    orgId: string,
    dto: CreateVehicleDto,
  ): Promise<void> {
    const driverName = dto.operator?.trim();
    if (!driverName) return; // not adding a driver — quota not relevant

    const quota = await this.orgSettings.getQuota(orgId, 'maxDrivers');
    if (quota === null) return;

    // Distinct operator names currently in use for this org's live vehicles.
    const distinctOperators = await this.vehicleRepo
      .createQueryBuilder('v')
      .select('LOWER(TRIM(v.operator))', 'op')
      .where('v.orgId = :orgId', { orgId })
      .andWhere('v.deletedAt IS NULL')
      .andWhere('v.operator IS NOT NULL')
      .andWhere("TRIM(v.operator) <> ''")
      .groupBy('LOWER(TRIM(v.operator))')
      .getRawMany<{ op: string }>();

    const existingNames = new Set(distinctOperators.map((r) => r.op));
    const incomingName = driverName.toLowerCase();

    // If the incoming operator name already exists in the org, it's a
    // re-use — no new driver is being introduced, so the cap doesn't fire.
    if (existingNames.has(incomingName)) return;

    if (existingNames.size >= quota) {
      throw new UnprocessableEntityException({
        code: 'QuotaExceeded',
        message: `Your organization has reached its drivers limit (${quota}). Contact your administrator to increase the cap.`,
        statusCode: 422,
      });
    }
  }

  /**
   * Fill speedLimitKmh / idleThresholdMin from `org_settings.vehicle_defaults`
   * when the caller didn't provide them. Boolean defaults (geofenceAlertEnabled,
   * harshDrivingEnabled) are read but skipped here because the vehicle entity
   * doesn't expose matching columns yet — when those columns land, extend this
   * helper to map them through. Fail-open: any settings read failure leaves
   * dto untouched and the entity's DB default applies.
   */
  private async applyVehicleDefaults(orgId: string, dto: CreateVehicleDto): Promise<void> {
    const defaults = await this.orgSettings.getVehicleDefaults(orgId);
    if (!defaults) return;
    if (dto.speedLimitKmh === undefined && dto.overspeed === undefined &&
        defaults.speedLimitKmh !== undefined) {
      dto.speedLimitKmh = defaults.speedLimitKmh;
    }
    if (dto.idleThresholdMin === undefined && defaults.idleTimeoutMin !== undefined) {
      dto.idleThresholdMin = defaults.idleTimeoutMin;
    }
  }

  /**
   * Validate `dto.customFields` against the org's vehicle-scoped custom field
   * catalog. Throws 400 BadRequest on:
   *   - unknown key (not declared on the catalog at this scope)
   *   - required key missing
   *   - type mismatch (string field with a number value, etc.)
   *   - enum value not in enumOptions
   *
   * No-op when the org has no vehicle-scoped catalog OR the caller didn't
   * supply customFields. Pure validation — doesn't mutate dto.
   */
  private async validateCustomFields(orgId: string, dto: CreateVehicleDto): Promise<void> {
    const catalog = await this.orgSettings.getCustomFieldsForScope(orgId, 'vehicle');
    const provided = (dto.customFields ?? null) as Record<string, unknown> | null;

    // No catalog → nothing to validate against; allow anything (legacy callers).
    if (!catalog.length) return;

    const byName = new Map(catalog.map((f) => [f.fieldName, f]));
    const errors: string[] = [];

    // Check required fields.
    for (const def of catalog) {
      if (def.required && (provided === null || provided[def.fieldName] === undefined)) {
        errors.push(`customFields.${def.fieldName} is required`);
      }
    }

    // Check provided keys exist and match types.
    if (provided !== null) {
      for (const [key, value] of Object.entries(provided)) {
        const def = byName.get(key);
        if (!def) {
          errors.push(`customFields.${key} is not declared in this organization's catalog`);
          continue;
        }
        if (value === null || value === undefined) continue;
        switch (def.fieldType) {
          case 'string':
            if (typeof value !== 'string') errors.push(`customFields.${key} must be a string`);
            break;
          case 'number':
            if (typeof value !== 'number' || !Number.isFinite(value))
              errors.push(`customFields.${key} must be a number`);
            break;
          case 'boolean':
            if (typeof value !== 'boolean') errors.push(`customFields.${key} must be a boolean`);
            break;
          case 'date':
            if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
              errors.push(`customFields.${key} must be an ISO date string`);
            break;
          case 'enum':
            if (typeof value !== 'string' ||
                !(def.enumOptions ?? []).includes(value)) {
              errors.push(
                `customFields.${key} must be one of [${(def.enumOptions ?? []).join(', ')}]`,
              );
            }
            break;
        }
      }
    }

    if (errors.length) {
      throw new HttpException(
        {
          success: false,
          error: { code: 'CustomFieldsValidationFailed', message: errors, statusCode: 400 },
        },
        400,
      );
    }
  }

  async create(
    orgId: string,
    dto: CreateVehicleDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Record<string, unknown>> {
    const existing = await this.vehicleRepo.findOne({
      where: { orgId, vehicleNo: dto.vehicleNo, deletedAt: IsNull() },
    });

    if (existing) {
      throw new ConflictException(
        `Vehicle with number '${dto.vehicleNo}' already exists for this organization`,
      );
    }

    await this.assertDriverQuota(orgId, dto);

    // Fill in fields the caller didn't specify from org_settings.vehicle_defaults.
    // Mutating the dto here keeps buildVehicleData's existing alias logic in
    // one place; settings are a "default if absent" — explicit dto values win.
    await this.applyVehicleDefaults(orgId, dto);

    // Validate any caller-supplied custom_fields payload against the org's
    // custom_fields catalog (vehicle-scoped definitions). Throws 400 on
    // schema mismatch — required keys missing, types wrong, unknown keys, etc.
    await this.validateCustomFields(orgId, dto);

    // ── Resolve cross-entity lookups BEFORE saving ──────────────────
    // (keeps us from leaving a half-created vehicle if a lookup fails)
    const resolvedDeviceId = await this.resolveDeviceId(orgId, dto);
    const resolvedUserId = await this.resolveUserId(orgId, dto);

    // Extract dates + aliases; map UI-facing names onto canonical columns.
    const vehicleData = this.buildVehicleData(orgId, dto, {
      resolvedDeviceId,
      resolvedUserId,
    });

    const vehicle = this.vehicleRepo.create(vehicleData);
    const saved = await this.vehicleRepo.save(vehicle);

    // ── Post-save side effects ──────────────────────────────────────
    // (any failure here is recoverable — the vehicle row is correct)
    try {
      if (resolvedDeviceId) {
        await this.linkDeviceToVehicle(resolvedDeviceId, saved.id);
      }

      // Use saved.userId (which is now populated from either the legacy
      // transporterUsername flow or the direct transporterId field) so
      // the subscription is written for transporterId callers too.
      if (saved.userId) {
        await this.upsertSubscription(orgId, saved.userId, dto);
      }
    } catch (err) {
      // Don't fail the vehicle create — log and keep going. Operators can
      // reconcile the device/subscription link separately if needed.
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Post-save side effect failed for vehicle ${saved.id}: ${error.message}`,
        error.stack,
      );
    }

    this.logger.log(
      `Vehicle created: ${saved.id} vehicleNo=${dto.vehicleNo}` +
        (resolvedDeviceId ? ` device=${resolvedDeviceId}` : '') +
        (resolvedUserId ? ` user=${resolvedUserId}` : ''),
    );

    await this.logAudit(
      orgId,
      userId,
      'vehicle.created',
      'vehicle',
      saved.id,
      null,
      saved,
      ipAddress,
    );

    // Return the same enriched shape as GET so the UI can re-render
    // without a follow-up GET call.
    const [enriched] = await this.enrichVehicles([saved]);
    return mapVehicleToResponse(enriched);
  }

  /**
   * Shape the DTO into a DeepPartial<Vehicle>, applying alias → canonical
   * mappings and dropping keys the entity doesn't own (imei,
   * transporterUsername, subscription*, autoRenewal — those live on other
   * tables and are handled separately).
   */
  private buildVehicleData(
    orgId: string,
    dto: CreateVehicleDto,
    resolved: { resolvedDeviceId: string | null; resolvedUserId: string | null },
  ): DeepPartial<Vehicle> {
    const parseDate = (s: string | null | undefined): Date | null =>
      s ? new Date(s) : null;

    // Alias resolution — DTO accepts both; canonical wins if both are present.
    const vType = dto.vType ?? dto.vehicleType;
    const vStatus = dto.vStatus ?? dto.vehicleStatus;
    const speedLimitKmh = dto.speedLimitKmh ?? dto.overspeed;
    const odometerKm = dto.odometerKm ?? dto.odometer;
    const remarks = dto.remarks ?? dto.remark;
    const remarks2 = dto.remarks2 ?? dto.extraRemark;
    const parkingViolationAlarm =
      dto.parkingViolationAlarm ?? dto.parkAlarmOnIgnitionOn;

    // `lock: true` → locked, else keep unlock default. Applied only when
    // explicitly provided so legacy callers aren't affected.
    // Prefer explicit lockStatus string; fall back to the boolean `lock` alias.
    const lockStatus =
      dto.lockStatus ??
      (typeof dto.lock === 'boolean' ? (dto.lock ? 'locked' : 'unlock') : undefined);

    return {
      id: uuidv4(),
      orgId,

      vehicleNo: dto.vehicleNo,
      transporterId: dto.transporterId ?? null,
      // Keep user_id in sync with transporter_id so the subscription
      // upsert path (which keys off vehicle.user_id) has a real user to
      // anchor on. If the caller also used the legacy transporterUsername
      // flow, that wins (it was resolved against org membership).
      userId: resolved.resolvedUserId ?? dto.transporterId ?? null,
      currentDeviceId: resolved.resolvedDeviceId,

      ...(vType !== undefined && { vType }),
      ...(vStatus !== undefined && { vStatus }),

      make: dto.make ?? null,
      model: dto.model ?? null,
      year: dto.year ?? null,
      color: dto.color ?? null,
      vin: dto.vin ?? null,
      engineNumber: dto.engineNumber ?? null,
      vehicleBody: dto.vehicleBody ?? null,
      ownerName: dto.ownerName ?? null,
      ownedBy: dto.ownedBy ?? null,
      capacity: dto.capacity ?? null,
      operator: dto.operator ?? null,
      fuelTankCapacityL: dto.fuelTankCapacityL ?? null,
      fuelType: dto.fuelType ?? null,
      alias: dto.alias ?? null,

      manufactureDate: parseDate(dto.manufactureDate),
      purchaseDate: parseDate(dto.purchaseDate),
      registrationExpiry: parseDate(dto.registrationExpiry),
      insuranceExpiry: parseDate(dto.insuranceExpiry),

      ...(speedLimitKmh !== undefined && { speedLimitKmh }),
      ...(dto.idleThresholdMin !== undefined && {
        idleThresholdMin: dto.idleThresholdMin,
      }),
      ...(odometerKm !== undefined && { odometerKm }),
      ...(dto.durationOdometer !== undefined && {
        durationOdometer: dto.durationOdometer,
      }),
      ...(dto.mileage !== undefined && { mileage: dto.mileage }),

      ...(remarks !== undefined && { remarks }),
      ...(remarks2 !== undefined && { remarks2 }),

      attachedCoin: dto.attachedCoin ?? null,

      ...(parkingViolationAlarm !== undefined && { parkingViolationAlarm }),
      ...(lockStatus !== undefined && { lockStatus }),

      customFields: dto.customFields ?? null,
    };
  }

  /**
   * Resolve IMEI → device UUID. Preference:
   *   1. dto.currentDeviceId — explicit UUID wins
   *   2. dto.imei             — look up device in the same org
   * Throws if the IMEI was provided but not found (fail fast so the UI
   * doesn't silently create a vehicle without the intended device link).
   */
  private async resolveDeviceId(
    orgId: string,
    dto: CreateVehicleDto,
  ): Promise<string | null> {
    if (dto.currentDeviceId) return dto.currentDeviceId;
    if (!dto.imei) return null;

    const device = await this.deviceRepo.findOne({
      where: { imei: dto.imei, orgId, deletedAt: IsNull() },
    });
    if (!device) {
      throw new NotFoundException(
        `Device with IMEI '${dto.imei}' not found in this organization`,
      );
    }
    return device.id;
  }

  /**
   * Resolve transporterUsername → users.id. Only considers users that are
   * members of the current org (via organization_users) so cross-org
   * assignment is impossible from this endpoint.
   */
  private async resolveUserId(
    orgId: string,
    dto: CreateVehicleDto,
  ): Promise<string | null> {
    if (!dto.transporterUsername) return null;

    const user = await this.userRepo.findOne({
      where: { username: dto.transporterUsername, deletedAt: IsNull() },
    });
    if (!user) {
      throw new NotFoundException(
        `User with username '${dto.transporterUsername}' not found`,
      );
    }

    // Confirm they actually belong to this org
    const membership = await this.orgUserRepo.findOne({
      where: { organizationId: orgId, userId: user.id, deletedAt: IsNull() },
    });
    if (!membership) {
      throw new NotFoundException(
        `User '${dto.transporterUsername}' is not a member of this organization`,
      );
    }
    return user.id;
  }

  /**
   * Wire the device ↔ vehicle link on the devices side.
   * Keeps `assigned = true` and refreshes `current_vehicle_id` in a
   * single UPDATE; TypeORM skips writes for unchanged columns.
   */
  private async linkDeviceToVehicle(
    deviceId: string,
    vehicleId: string,
  ): Promise<void> {
    await this.deviceRepo.update(
      { id: deviceId },
      { currentVehicleId: vehicleId, assigned: true },
    );
  }

  /**
   * Upsert subscription details onto organization_users for the resolved
   * (orgId, userId) pair. Any of the three fields may be absent; we only
   * touch what the caller provided so we never clear existing data
   * accidentally.
   */
  private async upsertSubscription(
    orgId: string,
    userId: string,
    dto: CreateVehicleDto,
  ): Promise<void> {
    const hasSubscription =
      dto.subscriptionStart !== undefined ||
      dto.subscriptionDue !== undefined ||
      dto.autoRenewal !== undefined;
    if (!hasSubscription) return;

    const existing = await this.orgUserRepo.findOne({
      where: { organizationId: orgId, userId },
    });

    // Build a FRESH billing object via spread — never mutate the one
    // TypeORM handed us (update() sometimes ignores jsonb fields whose
    // reference hasn't changed, which is how `autoRenewal` silently
    // failed to persist).
    const existingBilling = (existing?.billingDetail ?? {}) as Record<string, unknown>;
    const billing: Record<string, unknown> = { ...existingBilling };
    if (typeof dto.autoRenewal === 'boolean') {
      billing.autoRenewal = dto.autoRenewal;
    }

    // organization_users.subscription_*_date columns are `date` type in PG
    // — TypeORM accepts an ISO `yyyy-MM-dd` slice.
    const toDateOnly = (iso: string | null | undefined): string | null => {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    };

    if (existing) {
      // Use save() rather than update() — save() reliably serialises jsonb,
      // update() can silently drop jsonb patches when the field's internal
      // reference is unchanged. Mutate the managed entity directly.
      existing.billingDetail = billing;
      if (dto.subscriptionStart !== undefined) {
        existing.subscriptionStartDate = toDateOnly(dto.subscriptionStart) as any;
      }
      if (dto.subscriptionDue !== undefined) {
        existing.subscriptionDueDate = toDateOnly(dto.subscriptionDue) as any;
      }
      await this.orgUserRepo.save(existing);
      this.logger.log(
        `Subscription updated for org=${orgId} user=${userId} billing=${JSON.stringify(billing)}`,
      );
    } else {
      await this.orgUserRepo.insert({
        organizationId: orgId,
        userId,
        role: 'user',
        status: 'active',
        isPrimary: false,
        subscriptionStartDate: toDateOnly(dto.subscriptionStart) as any,
        subscriptionDueDate: toDateOnly(dto.subscriptionDue) as any,
        subscriptionExtendedDate: null,
        subscriptionOverwriteAllVehicles: false,
        billingDetail: billing as any,
      });
      this.logger.log(
        `Subscription created for org=${orgId} user=${userId} billing=${JSON.stringify(billing)}`,
      );
    }
  }

  async bulkCreate(
    orgId: string,
    items: CreateVehicleDto[],
    userId: string,
    ipAddress?: string,
  ): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    results: Array<{
      index: number;
      success: boolean;
      data?: Record<string, unknown>;
      error?: string;
      statusCode?: number;
    }>;
  }> {
    const results: Array<{
      index: number;
      success: boolean;
      data?: Record<string, unknown>;
      error?: string;
      statusCode?: number;
    }> = [];
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      try {
        const data = await this.create(orgId, items[i], userId, ipAddress);
        results.push({ index: i, success: true, data });
        succeeded++;
      } catch (err) {
        const { message, statusCode } = extractRowError(err);
        results.push({ index: i, success: false, error: message, statusCode });
        failed++;
      }
    }

    return { total: items.length, succeeded, failed, results };
  }

  async findAll(
    orgId: string,
    filter: FilterVehicleDto,
    isSystemAdmin = false,
  ): Promise<{ data: Record<string, unknown>[]; meta: any }> {
    const query = this.vehicleRepo
      .createQueryBuilder('v')
      .where('v.deleted_at IS NULL');

    // Org scoping. System-admins may target multiple orgs via `orgIds`.
    // Everyone else (and any request without orgIds) is locked to their
    // single authenticated org — orgIds from a non-admin is ignored, never
    // a cross-tenant leak.
    if (isSystemAdmin && filter.orgIds?.length) {
      query.andWhere('v.organization_id IN (:...orgIds)', {
        orgIds: filter.orgIds,
      });
    } else {
      query.andWhere('v.organization_id = :orgId', { orgId });
    }

    if (filter.vStatus) {
      query.andWhere('v.v_status = :vStatus', { vStatus: filter.vStatus });
    }

    if (filter.vType) {
      query.andWhere('v.v_type = :vType', { vType: filter.vType });
    }

    if (filter.connectivityState) {
      query.andWhere('v.connectivity_state = :connectivityState', { connectivityState: filter.connectivityState });
    }

    if (filter.ignitionState) {
      query.andWhere('v.ignition_state = :ignitionState', { ignitionState: filter.ignitionState });
    }

    if (filter.search) {
      // `v.transporter` (freeform text column) dropped from the search
      // clause — the field is no longer accepted on POST/PATCH, so
      // newer rows never populate it. Legacy data remains accessible
      // via direct SQL if anyone still needs it.
      query.andWhere(
        '(v.vehicle_no ILIKE :search OR v.owner_name ILIKE :search OR v.owned_by ILIKE :search OR v.make ILIKE :search OR v.model ILIKE :search OR v.vehicle_body ILIKE :search OR v.alias ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    // `entityId` + optional `assignedTo` — mirrors groups-service pattern.
    //   VEHICLE     → match v.user_id        (assigned user)
    //   TRANSPORTER → match v.transporter_id (transporter user)
    //   ORG         → match v.organization_id
    //   (none)      → OR across all three columns
    if (filter.entityId) {
      const entityParam = { entityId: filter.entityId };
      if (filter.assignedTo === 'VEHICLE') {
        query.andWhere('v.user_id = :entityId', entityParam);
      } else if (filter.assignedTo === 'TRANSPORTER') {
        query.andWhere('v.transporter_id = :entityId', entityParam);
      } else if (filter.assignedTo === 'ORG') {
        query.andWhere('v.organization_id = :entityId', entityParam);
      } else {
        query.andWhere(
          '(v.user_id = :entityId OR v.transporter_id = :entityId OR v.organization_id = :entityId)',
          entityParam,
        );
      }
    }

    // `transporterIds` — match any of the given transporter user IDs.
    if (filter.transporterIds?.length) {
      query.andWhere('v.transporter_id IN (:...transporterIds)', {
        transporterIds: filter.transporterIds,
      });
    }

    // `groupIds` — vehicles have no group column, so resolve through the
    // assigned user's group membership: v.user_id must belong to an
    // organization_users row whose group_id is in the requested set.
    if (filter.groupIds?.length) {
      query.andWhere(
        'v.user_id IN (SELECT ou.user_id FROM organization_users ou WHERE ou.group_id IN (:...groupIds) AND ou.deleted_at IS NULL)',
        { groupIds: filter.groupIds },
      );
    }

    // `monthYear` — "MM-yyyy" single param covering month + year. Parsed
    // here (DTO regex already enforced the shape) and applied as two
    // EXTRACT() predicates on created_at. Using a half-open date-range
    // would be index-friendlier, but EXTRACT keeps the query shape simple
    // and correct for our small row counts.
    if (filter.monthYear) {
      const [mmStr, yyyyStr] = filter.monthYear.split('-');
      const mm = Number(mmStr);
      const yyyy = Number(yyyyStr);
      query.andWhere(
        'EXTRACT(YEAR FROM v.created_at) = :filterYear AND EXTRACT(MONTH FROM v.created_at) = :filterMonth',
        { filterYear: yyyy, filterMonth: mm },
      );
    }

    const total = await query.getCount();
    const vehicles = await query
      .orderBy('v.created_at', 'DESC')
      .skip((filter.page - 1) * filter.limit)
      .take(filter.limit)
      .getMany();

    const enriched = await this.enrichVehicles(vehicles);

    return {
      data: enriched.map(mapVehicleToResponse),
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: Math.ceil(total / filter.limit),
      },
    };
  }

  async findOne(orgId: string, id: string): Promise<Record<string, unknown>> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id, orgId, deletedAt: IsNull() },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID '${id}' not found`);
    }

    const [enriched] = await this.enrichVehicles([vehicle]);
    return mapVehicleToResponse(enriched);
  }

  /**
   * Internal helper used by create/update to fetch the raw Vehicle entity
   * without running the enrichment (audit logging + duplicate checks don't
   * need the joined fields).
   */
  private async findRawVehicle(orgId: string, id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id, orgId, deletedAt: IsNull() },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID '${id}' not found`);
    }
    return vehicle;
  }

  /**
   * Batch-fetch the cross-entity rows needed to enrich a list of vehicles.
   *
   * Runs 4 small IN() queries concurrently (devices, organization_users,
   * users, organizations) instead of a 4-way JOIN so we keep the vehicle
   * query's existing filtering/pagination intact and only pay for the rows
   * actually being returned.
   */
  private async enrichVehicles(
    vehicles: Vehicle[],
  ): Promise<EnrichedVehicleRow[]> {
    if (vehicles.length === 0) return [];

    // Derive the org set from the vehicles themselves so a multi-org result
    // (system-admin querying several orgs) enriches every row, not just one
    // org. For single-org callers this is just the one org.
    const orgIds = Array.from(
      new Set(vehicles.map((v) => v.orgId).filter((x): x is string => Boolean(x))),
    );

    const deviceIds = Array.from(
      new Set(
        vehicles
          .map((v) => v.currentDeviceId)
          .filter((x): x is string => Boolean(x)),
      ),
    );
    // userId still exists internally (subscription upserts key off it) but
    // the response only surfaces the transporter. Look up both sets of IDs
    // so one users query covers every ref we need.
    const userIds = Array.from(
      new Set(
        vehicles
          .map((v) => v.userId)
          .filter((x): x is string => Boolean(x)),
      ),
    );
    const transporterIds = Array.from(
      new Set(
        vehicles
          .map((v) => v.transporterId)
          .filter((x): x is string => Boolean(x)),
      ),
    );
    const allUserIds = Array.from(new Set([...userIds, ...transporterIds]));

    const [devices, orgUsers, users, organizations] = await Promise.all([
      deviceIds.length
        ? this.deviceRepo.find({
            where: { id: In(deviceIds), orgId: In(orgIds), deletedAt: IsNull() },
          })
        : Promise.resolve<DeviceRef[]>([]),
      userIds.length
        ? this.orgUserRepo.find({
            where: {
              organizationId: In(orgIds),
              userId: In(userIds),
              deletedAt: IsNull(),
            },
          })
        : Promise.resolve<OrganizationUserRef[]>([]),
      allUserIds.length
        ? this.userRepo.find({
            where: { id: In(allUserIds), deletedAt: IsNull() },
          })
        : Promise.resolve<UserRef[]>([]),
      // organizations.id IS the org id — there's no separate org_id column
      this.organizationRepo.find({ where: { id: In(orgIds) } }),
    ]);

    const devicesById = new Map(devices.map((d) => [d.id, d]));
    // Key org-user by org+user so two memberships of the same user in
    // different orgs don't collide on a multi-org result.
    const orgUsersByOrgUser = new Map(
      orgUsers.map((ou) => [`${ou.organizationId}:${ou.userId}`, ou]),
    );
    const usersById = new Map(users.map((u) => [u.id, u]));
    const orgsById = new Map(organizations.map((o) => [o.id, o]));

    return vehicles.map((vehicle) => ({
      vehicle,
      device: vehicle.currentDeviceId
        ? (devicesById.get(vehicle.currentDeviceId) ?? null)
        : null,
      orgUser: vehicle.userId
        ? (orgUsersByOrgUser.get(`${vehicle.orgId}:${vehicle.userId}`) ?? null)
        : null,
      transporter: vehicle.transporterId
        ? (usersById.get(vehicle.transporterId) ?? null)
        : null,
      organization: orgsById.get(vehicle.orgId) ?? null,
    }));
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateVehicleDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Record<string, unknown>> {
    const vehicle = await this.findRawVehicle(orgId, id);
    const oldValue = { ...vehicle };

    // If changing vehicle number, check for duplicates
    if (dto.vehicleNo && dto.vehicleNo !== vehicle.vehicleNo) {
      const duplicate = await this.vehicleRepo.findOne({
        where: { orgId, vehicleNo: dto.vehicleNo, deletedAt: IsNull() },
      });
      if (duplicate) {
        throw new ConflictException(
          `Vehicle with number '${dto.vehicleNo}' already exists for this organization`,
        );
      }
    }

    // ── Cross-entity lookups (only when caller provided them) ──────
    if (dto.imei !== undefined || dto.currentDeviceId !== undefined) {
      const resolvedDeviceId = await this.resolveDeviceId(
        orgId,
        dto as CreateVehicleDto,
      );
      vehicle.currentDeviceId = resolvedDeviceId;
      if (resolvedDeviceId) {
        await this.linkDeviceToVehicle(resolvedDeviceId, vehicle.id);
      }
    }

    if (dto.transporterUsername !== undefined) {
      vehicle.userId = await this.resolveUserId(orgId, dto as CreateVehicleDto);
    }

    // ── Apply field-level updates with alias → canonical mapping ───
    this.applyDtoToVehicle(vehicle, dto);

    const saved = await this.vehicleRepo.save(vehicle);

    // ── Subscription upsert (only if the caller provided any of the
    //    three fields AND the vehicle has a resolved user) ─────────
    if (saved.userId) {
      try {
        await this.upsertSubscription(orgId, saved.userId, dto as CreateVehicleDto);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.error(
          `Subscription upsert failed for vehicle ${id}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log(`Vehicle updated: ${id}`);

    await this.logAudit(orgId, userId, 'vehicle.updated', 'vehicle', id, oldValue, saved, ipAddress);

    // Return the enriched shape — callers that depend on the
    // Vehicle-shaped response should switch to reading `id` / use GET :id.
    const [enriched] = await this.enrichVehicles([saved]);
    return mapVehicleToResponse(enriched);
  }

  /**
   * Apply the DTO's field-level values to an existing Vehicle instance,
   * resolving aliases (overspeed, odometer, extraRemark, …) to the
   * canonical column names. Cross-entity fields (imei,
   * transporterUsername, subscription*, autoRenewal) are NOT touched here
   * — the caller handles them separately.
   */
  private applyDtoToVehicle(vehicle: Vehicle, dto: UpdateVehicleDto): void {
    const setIf = <K extends keyof Vehicle>(
      key: K,
      value: Vehicle[K] | undefined,
    ): void => {
      if (value !== undefined) {
        vehicle[key] = value;
      }
    };

    if (dto.vehicleNo !== undefined) vehicle.vehicleNo = dto.vehicleNo;
    if (dto.transporterId !== undefined) {
      vehicle.transporterId = dto.transporterId ?? null;
      // Keep user_id aligned — subscription upserts key off user_id.
      vehicle.userId = dto.transporterId ?? null;
    }
    if (dto.attachedCoin !== undefined)
      vehicle.attachedCoin = dto.attachedCoin ?? null;

    // Alias resolution
    const vType = dto.vType ?? dto.vehicleType;
    if (vType !== undefined) vehicle.vType = vType;

    const vStatus = dto.vStatus ?? dto.vehicleStatus;
    if (vStatus !== undefined) vehicle.vStatus = vStatus;

    if (dto.make !== undefined) vehicle.make = dto.make ?? null;
    if (dto.model !== undefined) vehicle.model = dto.model ?? null;
    if (dto.year !== undefined) vehicle.year = dto.year ?? null;
    if (dto.color !== undefined) vehicle.color = dto.color ?? null;
    if (dto.vin !== undefined) vehicle.vin = dto.vin ?? null;
    if (dto.engineNumber !== undefined)
      vehicle.engineNumber = dto.engineNumber ?? null;
    if (dto.vehicleBody !== undefined)
      vehicle.vehicleBody = dto.vehicleBody ?? null;
    if (dto.ownerName !== undefined) vehicle.ownerName = dto.ownerName ?? null;
    if (dto.ownedBy !== undefined) vehicle.ownedBy = dto.ownedBy ?? null;
    if (dto.capacity !== undefined) vehicle.capacity = dto.capacity ?? null;
    if (dto.operator !== undefined) vehicle.operator = dto.operator ?? null;
    if (dto.fuelTankCapacityL !== undefined)
      vehicle.fuelTankCapacityL = dto.fuelTankCapacityL ?? null;
    if (dto.fuelType !== undefined) vehicle.fuelType = dto.fuelType ?? null;
    if (dto.alias !== undefined) vehicle.alias = dto.alias ?? null;

    const parse = (s: string | undefined): Date | null =>
      s ? new Date(s) : null;
    if (dto.manufactureDate !== undefined)
      vehicle.manufactureDate = parse(dto.manufactureDate);
    if (dto.purchaseDate !== undefined)
      vehicle.purchaseDate = parse(dto.purchaseDate);
    if (dto.registrationExpiry !== undefined)
      vehicle.registrationExpiry = parse(dto.registrationExpiry);
    if (dto.insuranceExpiry !== undefined)
      vehicle.insuranceExpiry = parse(dto.insuranceExpiry);

    const speedLimitKmh = dto.speedLimitKmh ?? dto.overspeed;
    setIf('speedLimitKmh', speedLimitKmh);
    setIf('idleThresholdMin', dto.idleThresholdMin);

    const odometerKm = dto.odometerKm ?? dto.odometer;
    setIf('odometerKm', odometerKm);
    setIf('durationOdometer', dto.durationOdometer);
    setIf('mileage', dto.mileage);

    const remarks = dto.remarks ?? dto.remark;
    if (remarks !== undefined) vehicle.remarks = remarks ?? null;
    const remarks2 = dto.remarks2 ?? dto.extraRemark;
    if (remarks2 !== undefined) vehicle.remarks2 = remarks2 ?? null;

    const parkingViolationAlarm =
      dto.parkingViolationAlarm ?? dto.parkAlarmOnIgnitionOn;
    setIf('parkingViolationAlarm', parkingViolationAlarm);

    // Prefer explicit lockStatus string; fall back to the boolean `lock` alias.
    if (dto.lockStatus !== undefined) {
      vehicle.lockStatus = dto.lockStatus;
    } else if (typeof dto.lock === 'boolean') {
      vehicle.lockStatus = dto.lock ? 'locked' : 'unlock';
    }

    if (dto.customFields !== undefined)
      vehicle.customFields = dto.customFields ?? null;
  }

  async remove(
    orgId: string,
    id: string,
    userId: string,
    ipAddress?: string,
  ): Promise<void> {
    const vehicle = await this.findRawVehicle(orgId, id);

    // If a device is linked to this vehicle, unlink it before the soft delete
    // so the device row doesn't keep dangling assigned=true / current_vehicle_id
    // pointing at a tombstoned vehicle.
    const previousDeviceId = vehicle.currentDeviceId;
    if (previousDeviceId) {
      await this.deviceRepo.update(
        { id: previousDeviceId },
        { currentVehicleId: null, assigned: false },
      );
      vehicle.currentDeviceId = null;
    }

    // Soft delete the vehicle
    vehicle.deletedAt = new Date();
    await this.vehicleRepo.save(vehicle);

    await this.logAudit(orgId, userId, 'vehicle.deleted', 'vehicle', id, vehicle, null, ipAddress);
    if (previousDeviceId) {
      await this.logAudit(
        orgId,
        userId,
        'device.unassigned_from_deleted_vehicle',
        'device',
        previousDeviceId,
        { vehicleId: id },
        null,
        ipAddress,
      );
    }
  }

  /**
   * Append-only audit log with exponential backoff retry.
   * Fire-and-forget — never throws to the caller.
   */
  private async logAudit(
    orgId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValue: any,
    newValue: any,
    ipAddress?: string,
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const entry = this.auditLogRepo.create({
          userId,
          transporterId: orgId,
          action,
          entityType,
          entityId,
          changes: {
            old: oldValue ?? null,
            new: newValue ?? null,
          },
          ipAddress: ipAddress ?? null,
        } as AuditLog);

        await this.auditLogRepo.save(entry);
        return;
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) {
          this.logger.error(
            `Failed to write audit log after ${maxRetries} attempts: ${(err as Error).message}`,
            (err as Error).stack,
          );
          return; // Fire-and-forget: don't throw
        }
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = 100 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}

function extractRowError(err: unknown): { message: string; statusCode: number } {
  if (err instanceof HttpException) {
    const res = err.getResponse();
    let message: string;
    if (typeof res === 'string') {
      message = res;
    } else if (res && typeof res === 'object' && 'message' in res) {
      const m = (res as { message: unknown }).message;
      message = Array.isArray(m) ? m.join('; ') : String(m);
    } else {
      message = err.message;
    }
    return { message, statusCode: err.getStatus() };
  }
  return {
    message: err instanceof Error ? err.message : 'Unknown error',
    statusCode: 500,
  };
}
