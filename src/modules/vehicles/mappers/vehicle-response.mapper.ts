import { Vehicle } from '../entities/vehicle.entity';
import { DeviceRef } from '../entities/device.ref.entity';
import { OrganizationUserRef } from '../entities/organization-user.ref.entity';
import { UserRef } from '../entities/user.ref.entity';
import { OrganizationRef } from '../entities/organization.ref.entity';

/** Input bundle assembled by the service after the JOIN query. */
export interface EnrichedVehicleRow {
  vehicle: Vehicle;
  device: DeviceRef | null;
  orgUser: OrganizationUserRef | null;
  user: UserRef | null;
  organization: OrganizationRef | null;
}

/** User details block surfaced on every vehicle when a user is assigned. */
export interface AssignedUserDto {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isOrgAdmin: boolean;
}

/**
 * Label maps — ignition_state and v_type are stored as lowercase enums in
 * the DB but the clients want proper title-cased labels like "Ignition off"
 * and "Personal Car". Centralised here so every GET endpoint stays in sync.
 */
const IGNITION_STATE_LABELS: Record<string, string> = {
  on: 'Ignition on',
  off: 'Ignition off',
  unknown: 'Unknown',
  idle: 'Idle',
  moving: 'Moving',
  stopped: 'Stopped',
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  sedan: 'Sedan',
  suv: 'SUV',
  pickup: 'Pickup',
  truck: 'Truck',
  bus: 'Bus',
  motorcycle: 'Motorcycle',
  genset: 'Genset',
  machinery: 'Machinery',
  trailer: 'Trailer',
  personal_car: 'Personal Car',
  other: 'Other',
};

const DEVICE_TYPE_LABELS: Record<string, string> = {
  teltonika: 'Teltonika',
  concox: 'Concox',
  jimi: 'Jimi',
  ruptela: 'Ruptela',
  queclink: 'Queclink',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  maintenance: 'Maintenance',
  decommissioned: 'Decommissioned',
  suspended: 'Suspended',
  expired: 'Expired',
};

/** Zero-pad to width 2 — used by the date formatter. */
const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Format a Date as `dd/MM/yyyy HH:mm:ss`. Returns null for null/undefined. */
export const formatDateTime = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return (
    `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` +
    ` ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
};

/** Format a Date or ISO-date-string as `dd/MM/yyyy`. */
export const formatDate = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const labelOrRaw = (map: Record<string, string>, key: string | null | undefined): string | null => {
  if (!key) return null;
  return map[key.toLowerCase()] ?? key;
};

/**
 * Transform a joined row into the enriched response shape expected by the
 * web + mobile clients. Extra derived fields come from three sources:
 *   - Vehicle (existing row)                 — base fields + dates
 *   - DeviceRef (joined on current_device_id)— IMEI / SIM / ignition flags
 *   - OrganizationUserRef (user subscription)— start/due dates + autoRenewal
 *   - UserRef + OrganizationRef              — user block + companyName
 */
export function mapVehicleToResponse(row: EnrichedVehicleRow): Record<string, unknown> {
  const { vehicle, device, orgUser, user, organization } = row;

  const assigned = Boolean(vehicle.currentDeviceId || device?.assigned);

  // `autoRenewal` isn't a top-level column on organization_users — it lives
  // inside the `billing_detail` jsonb. Look for either camelCase or snake_case.
  const billing = (orgUser?.billingDetail ?? {}) as Record<string, unknown>;
  const autoRenewal =
    typeof billing.autoRenewal === 'boolean'
      ? (billing.autoRenewal as boolean)
      : typeof billing.auto_renewal === 'boolean'
        ? (billing.auto_renewal as boolean)
        : false;

  const assignedUser: AssignedUserDto | null = user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phoneNumber,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
        isOrgAdmin: user.isOrgAdmin,
      }
    : null;

  return {
    // ── Core vehicle identity ────────────────────────────────────
    id: vehicle.id,
    orgId: vehicle.orgId,
    vehicleNo: vehicle.vehicleNo,
    alias: vehicle.alias,
    transporter: vehicle.transporter,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color,
    vin: vehicle.vin,
    engineNumber: vehicle.engineNumber,
    vehicleBody: vehicle.vehicleBody,
    ownerName: vehicle.ownerName,
    ownedBy: vehicle.ownedBy,
    operator: vehicle.operator,
    capacity: vehicle.capacity,
    manufactureDate: formatDate(vehicle.manufactureDate),
    purchaseDate: formatDate(vehicle.purchaseDate),

    // ── Type / status — label-mapped ─────────────────────────────
    vehicleType: labelOrRaw(VEHICLE_TYPE_LABELS, vehicle.vType),
    vehicleStatus: labelOrRaw(STATUS_LABELS, vehicle.vStatus),
    state: labelOrRaw(IGNITION_STATE_LABELS, vehicle.ignitionState),
    connectivityState: vehicle.connectivityState,

    // ── Location / telemetry snapshot ────────────────────────────
    address: vehicle.lastAddress,
    lastLatitude: vehicle.lastLatitude,
    lastLongitude: vehicle.lastLongitude,
    lastSpeedKmh: vehicle.lastSpeedKmh,
    lastHeading: vehicle.lastHeading,
    lu: formatDateTime(vehicle.lastDataAt),

    // ── Numbers ──────────────────────────────────────────────────
    mileage: Number(vehicle.mileage ?? 0),
    overspeed: vehicle.speedLimitKmh,
    odometer: Math.round(Number(vehicle.odometerKm ?? 0)),
    engineHours: Number(vehicle.engineHours ?? 0),
    fuelTankCapacityL: vehicle.fuelTankCapacityL,
    todayDistanceKm: Number(vehicle.todayDistanceKm ?? 0),
    totalDistanceKm: Number(vehicle.totalDistanceKm ?? 0),
    idleThresholdMin: vehicle.idleThresholdMin,

    // ── Boolean/enum flags ───────────────────────────────────────
    elLockStatus: vehicle.elLockStatus,
    lockStatus: vehicle.lockStatus,
    panicState: vehicle.panicState,
    parkingViolationAlarm: vehicle.parkingViolationAlarm,
    fuelType: vehicle.fuelType,
    durationOdometer: vehicle.durationOdometer,

    // ── Text / misc ──────────────────────────────────────────────
    extraRemark: vehicle.remarks2 ?? '',
    remarks: vehicle.remarks,
    registrationExpiry: formatDate(vehicle.registrationExpiry),
    insuranceExpiry: formatDate(vehicle.insuranceExpiry),
    customFields: vehicle.customFields,

    // ── Device block (from devices table) ────────────────────────
    assigned,
    currentDeviceId: vehicle.currentDeviceId,
    imei: device?.imei ?? null,
    simNo: device?.simNumber ?? null,
    simProvider: device?.simProvider ?? null,
    deviceType: labelOrRaw(DEVICE_TYPE_LABELS, device?.dType),
    deviceStatus: labelOrRaw(STATUS_LABELS, device?.deviceStatus),
    deviceModel: device?.model ?? null,
    deviceManufacturer: device?.manufacturer ?? null,
    firmwareVersion: device?.firmwareVersion ?? null,
    ignitionWirePositive: device?.ignWire ?? false,
    ignitionNotConnected: device?.ignWireNotConnected ?? false,
    ac: device?.acWire ?? false,
    deviceInstalledAt: formatDateTime(device?.installedAt),
    lastHeartbeatAt: formatDateTime(device?.lastHeartbeatAt),

    // ── Subscription (from organization_users for vehicle.user_id) ──
    subscriptionStart: formatDate(orgUser?.subscriptionStartDate),
    subscriptionDue: formatDate(orgUser?.subscriptionDueDate),
    subscriptionExtended: formatDate(orgUser?.subscriptionExtendedDate),
    autoRenewal,
    billingDetail: orgUser?.billingDetail ?? null,

    // ── Company (from organizations table) ───────────────────────
    companyName: organization?.orgName ?? null,
    organizationEmail: organization?.email ?? null,
    organizationPhone: organization?.phoneNumber ?? null,

    // ── Assigned user (from users table via vehicle.user_id) ─────
    userId: vehicle.userId,
    assignedUser,

    // ── Timestamps ───────────────────────────────────────────────
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
    modifiedDate: formatDate(vehicle.updatedAt),
  };
}
