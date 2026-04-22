import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
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
  ) {}

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

      if (resolvedUserId) {
        await this.upsertSubscription(orgId, resolvedUserId, dto);
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
    const [enriched] = await this.enrichVehicles(orgId, [saved]);
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
    const lockStatus =
      typeof dto.lock === 'boolean' ? (dto.lock ? 'locked' : 'unlock') : undefined;

    return {
      id: uuidv4(),
      orgId,

      vehicleNo: dto.vehicleNo,
      transporter: dto.transporter ?? null,
      transporterId: dto.transporterId ?? null,
      userId: resolved.resolvedUserId,
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

    const billing = (existing?.billingDetail ?? {}) as Record<string, unknown>;
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
      // `billing_detail` is jsonb — TypeORM's QueryDeepPartialEntity type is
      // overly strict about object types here, so we cast to `any`. The
      // value is validated upstream.
      const patch: Record<string, unknown> = { billingDetail: billing };
      if (dto.subscriptionStart !== undefined) {
        patch.subscriptionStartDate = toDateOnly(dto.subscriptionStart);
      }
      if (dto.subscriptionDue !== undefined) {
        patch.subscriptionDueDate = toDateOnly(dto.subscriptionDue);
      }
      await this.orgUserRepo.update(
        { organizationId: orgId, userId },
        patch as any,
      );
      this.logger.log(
        `Subscription updated for org=${orgId} user=${userId}`,
      );
    } else {
      await this.orgUserRepo.insert({
        organizationId: orgId,
        userId,
        role: 'user',
        status: 'active',
        isPrimary: false,
        subscriptionStartDate: toDateOnly(dto.subscriptionStart),
        subscriptionDueDate: toDateOnly(dto.subscriptionDue),
        subscriptionExtendedDate: null,
        subscriptionOverwriteAllVehicles: false,
        billingDetail: billing as any,
      });
      this.logger.log(
        `Subscription created for org=${orgId} user=${userId}`,
      );
    }
  }

  async findAll(
    orgId: string,
    filter: FilterVehicleDto,
  ): Promise<{ data: Record<string, unknown>[]; meta: any }> {
    const query = this.vehicleRepo
      .createQueryBuilder('v')
      .where('v.organization_id = :orgId', { orgId })
      .andWhere('v.deleted_at IS NULL');

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
      query.andWhere(
        '(v.vehicle_no ILIKE :search OR v.owner_name ILIKE :search OR v.owned_by ILIKE :search OR v.make ILIKE :search OR v.model ILIKE :search OR v.vehicle_body ILIKE :search OR v.alias ILIKE :search OR v.transporter ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    // `transporterId` — exact UUID match on the dedicated v.transporter_id
    // column (partial btree index `idx_vehicles_transporter_id` covers this).
    if (filter.transporterId) {
      query.andWhere('v.transporter_id = :transporterIdFilter', {
        transporterIdFilter: filter.transporterId,
      });
    }

    // `orgId` — exact UUID match on vehicles.organization_id. In normal
    // org-scoped calls this is redundant with the earlier orgId WHERE, but
    // accepted so cross-org admin tooling can scope explicitly.
    if (filter.orgId) {
      query.andWhere('v.organization_id = :filterOrgId', {
        filterOrgId: filter.orgId,
      });
    }

    // `entityId` + optional `assignedTo` — mirrors groups-service pattern.
    //   VEHICLE     → match v.user_id        (assigned user)
    //   TRANSPORTER → match v.transporter_id (transporter user)
    //   (none)      → OR across user_id / transporter_id / organization_id
    if (filter.entityId) {
      const entityParam = { entityId: filter.entityId };
      if (filter.assignedTo === 'VEHICLE') {
        query.andWhere('v.user_id = :entityId', entityParam);
      } else if (filter.assignedTo === 'TRANSPORTER') {
        query.andWhere('v.transporter_id = :entityId', entityParam);
      } else {
        query.andWhere(
          '(v.user_id = :entityId OR v.transporter_id = :entityId OR v.organization_id = :entityId)',
          entityParam,
        );
      }
    }

    // `month` / `year` — filter by created_at components. Using EXTRACT so
    // the optimiser can still use an idx on created_at via a functional
    // predicate if one is added later.
    if (filter.year !== undefined) {
      query.andWhere('EXTRACT(YEAR FROM v.created_at) = :filterYear', {
        filterYear: filter.year,
      });
    }
    if (filter.month !== undefined) {
      query.andWhere('EXTRACT(MONTH FROM v.created_at) = :filterMonth', {
        filterMonth: filter.month,
      });
    }

    const total = await query.getCount();
    const vehicles = await query
      .orderBy('v.created_at', 'DESC')
      .skip((filter.page - 1) * filter.limit)
      .take(filter.limit)
      .getMany();

    const enriched = await this.enrichVehicles(orgId, vehicles);

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

    const [enriched] = await this.enrichVehicles(orgId, [vehicle]);
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
    orgId: string,
    vehicles: Vehicle[],
  ): Promise<EnrichedVehicleRow[]> {
    if (vehicles.length === 0) return [];

    const deviceIds = Array.from(
      new Set(
        vehicles
          .map((v) => v.currentDeviceId)
          .filter((x): x is string => Boolean(x)),
      ),
    );
    const userIds = Array.from(
      new Set(
        vehicles
          .map((v) => v.userId)
          .filter((x): x is string => Boolean(x)),
      ),
    );

    const [devices, orgUsers, users, organizations] = await Promise.all([
      deviceIds.length
        ? this.deviceRepo.find({
            where: { id: In(deviceIds), orgId, deletedAt: IsNull() },
          })
        : Promise.resolve<DeviceRef[]>([]),
      userIds.length
        ? this.orgUserRepo.find({
            where: {
              organizationId: orgId,
              userId: In(userIds),
              deletedAt: IsNull(),
            },
          })
        : Promise.resolve<OrganizationUserRef[]>([]),
      userIds.length
        ? this.userRepo.find({
            where: { id: In(userIds), deletedAt: IsNull() },
          })
        : Promise.resolve<UserRef[]>([]),
      // organizations.id IS the org id — there's no separate org_id column
      this.organizationRepo.find({ where: { id: orgId } }),
    ]);

    const devicesById = new Map(devices.map((d) => [d.id, d]));
    const orgUsersByUserId = new Map(orgUsers.map((ou) => [ou.userId, ou]));
    const usersById = new Map(users.map((u) => [u.id, u]));
    const organization = organizations[0] ?? null;

    return vehicles.map((vehicle) => ({
      vehicle,
      device: vehicle.currentDeviceId
        ? (devicesById.get(vehicle.currentDeviceId) ?? null)
        : null,
      orgUser: vehicle.userId
        ? (orgUsersByUserId.get(vehicle.userId) ?? null)
        : null,
      user: vehicle.userId ? (usersById.get(vehicle.userId) ?? null) : null,
      organization,
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
    const [enriched] = await this.enrichVehicles(orgId, [saved]);
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
    if (dto.transporter !== undefined)
      vehicle.transporter = dto.transporter ?? null;
    if (dto.transporterId !== undefined)
      vehicle.transporterId = dto.transporterId ?? null;
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

    if (typeof dto.lock === 'boolean') {
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

    // Soft delete
    vehicle.deletedAt = new Date();
    await this.vehicleRepo.save(vehicle);

    await this.logAudit(orgId, userId, 'vehicle.deleted', 'vehicle', id, vehicle, null, ipAddress);
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
