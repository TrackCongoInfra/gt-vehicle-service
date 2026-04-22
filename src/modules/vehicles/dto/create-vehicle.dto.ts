import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VehicleStatus, VehicleType } from '../entities/vehicle.entity';
import { coerceToIsoDate } from './date-format.helper';

/**
 * Create-vehicle payload.
 *
 * Accepts both the internal (camelCase entity-column) names AND the
 * UI-oriented aliases used by the web form (see screenshot):
 *   overspeed          → speedLimitKmh
 *   odometer           → odometerKm
 *   remark             → remarks
 *   extraRemark        → remarks2
 *   parkAlarmOnIgnitionOn → parkingViolationAlarm
 *   vehicleType        → vType
 *   vehicleStatus      → vStatus
 *
 * Plus the following cross-entity fields that the service resolves at
 * create time:
 *   imei                  → looks up device, sets currentDeviceId + updates
 *                           device.currentVehicleId + device.assigned
 *   transporterUsername   → looks up user, sets userId on the vehicle
 *   subscriptionStart /
 *   subscriptionDue /
 *   autoRenewal           → upserts organization_users row for (orgId, userId)
 *
 * Date fields accept `dd/MM/yyyy` (UI format) and ISO 8601.
 */
export class CreateVehicleDto {
  @ApiProperty({ example: 'N3-DORKAS', description: 'Vehicle registration number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  vehicleNo: string;

  @ApiPropertyOptional({ example: 'DHL Logistics', description: 'Transport company name (freeform)' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  transporter?: string;

  // ── Cross-entity lookups ──────────────────────────────────────────

  @ApiPropertyOptional({
    example: '353691846142395',
    description: 'IMEI of the device to attach — service will look up and wire the link both ways.',
  })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  imei?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'Direct device UUID (alternative to imei)' })
  @IsOptional()
  @IsUUID()
  currentDeviceId?: string;

  @ApiPropertyOptional({
    example: 'adamind',
    description: 'Transporter/owner username — resolved to users.id and stored as vehicles.user_id',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transporterUsername?: string;

  @ApiPropertyOptional({
    example: '64813de9-ca32-485a-a15c-1c194de1efac',
    description:
      'Direct UUID of the transporter user — stored as vehicles.transporter_id. ' +
      'Independent of the assigned user (user_id); a vehicle may be assigned to ' +
      'one user but transported by another.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  transporterId?: string;

  @ApiPropertyOptional({
    example: 'bL1gYhJ (11/05/2026)',
    description: 'Attached coin label (stored verbatim)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  attachedCoin?: string;

  // ── Subscription (stored on organization_users, not vehicles) ─────

  @ApiPropertyOptional({
    example: '21/04/2025',
    description: 'Subscription start date (dd/MM/yyyy or ISO 8601)',
  })
  @IsOptional()
  @Transform(({ value }) => coerceToIsoDate(value))
  @IsDateString()
  subscriptionStart?: string;

  @ApiPropertyOptional({
    example: '30/04/2027',
    description: 'Subscription due date (dd/MM/yyyy or ISO 8601)',
  })
  @IsOptional()
  @Transform(({ value }) => coerceToIsoDate(value))
  @IsDateString()
  subscriptionDue?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;

  // ── Vehicle classification ────────────────────────────────────────

  @ApiPropertyOptional({
    enum: VehicleType,
    default: VehicleType.OTHER,
    description: 'Lowercase enum accepted; "Truck", "SUV", etc. also coerced.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
    return normalized;
  })
  @IsEnum(VehicleType)
  vType?: VehicleType;

  /** Alias for vType used by the web form. */
  @ApiPropertyOptional({ example: 'Truck', description: 'Alias for vType — accepts title-case labels' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return value.trim().toLowerCase().replace(/\s+/g, '_');
  })
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ enum: VehicleStatus, default: VehicleStatus.ACTIVE })
  @IsOptional()
  @IsEnum(VehicleStatus)
  vStatus?: VehicleStatus;

  @ApiPropertyOptional({ enum: VehicleStatus })
  @IsOptional()
  @IsEnum(VehicleStatus)
  vehicleStatus?: VehicleStatus;

  @ApiPropertyOptional({ example: 'TOYOTA' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  make?: string;

  @ApiPropertyOptional({ example: 'Hilux' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  model?: string;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: 'White' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @ApiPropertyOptional({ example: 'JTFBT4K34M1234567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vin?: string;

  @ApiPropertyOptional({ example: '1GR-FE-1234567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  engineNumber?: string;

  @ApiPropertyOptional({ example: 'Panel Van' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleBody?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  ownerName?: string;

  @ApiPropertyOptional({ example: 'company' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ownedBy?: string;

  @ApiPropertyOptional({ example: 5.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  capacity?: number;

  @ApiPropertyOptional({ example: 'Driver Name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  operator?: string;

  @ApiPropertyOptional({ example: 80.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  fuelTankCapacityL?: number;

  @ApiPropertyOptional({ example: '2020-01-15' })
  @IsOptional()
  @Transform(({ value }) => coerceToIsoDate(value))
  @IsDateString()
  manufactureDate?: string;

  @ApiPropertyOptional({ example: '2021-03-20' })
  @IsOptional()
  @Transform(({ value }) => coerceToIsoDate(value))
  @IsDateString()
  purchaseDate?: string;

  // ── Thresholds / limits ───────────────────────────────────────────

  @ApiPropertyOptional({ example: 120, description: 'Internal canonical name for speedLimit' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  speedLimitKmh?: number;

  @ApiPropertyOptional({ example: 60, description: 'Alias for speedLimitKmh used by the web form' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  overspeed?: number;

  @ApiPropertyOptional({ example: 5, description: 'Idle threshold in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  idleThresholdMin?: number;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Transform(({ value }) => coerceToIsoDate(value))
  @IsDateString()
  registrationExpiry?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @Transform(({ value }) => coerceToIsoDate(value))
  @IsDateString()
  insuranceExpiry?: string;

  @ApiPropertyOptional({ example: '3488-AX-05' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  alias?: string;

  // ── Remarks — support both new aliases + legacy names ─────────────

  @ApiPropertyOptional({ example: 'Assigned to Kinshasa depot' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ example: 'Primary remark', description: 'Alias for remarks' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ example: 'Additional remarks' })
  @IsOptional()
  @IsString()
  remarks2?: string;

  @ApiPropertyOptional({ example: 'Secondary remark', description: 'Alias for remarks2' })
  @IsOptional()
  @IsString()
  extraRemark?: string;

  // ── Mileage / odometer ────────────────────────────────────────────

  @ApiPropertyOptional({ example: 15, description: 'Mileage correction factor (kmpl equivalent)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mileage?: number;

  @ApiPropertyOptional({ example: 'diesel' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  fuelType?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  durationOdometer?: number;

  @ApiPropertyOptional({ example: 403101, description: 'Alias for odometerKm' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  odometer?: number;

  @ApiPropertyOptional({ example: 403101 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  odometerKm?: number;

  // ── Flags ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: true, description: 'Internal canonical name for park-violation alarm' })
  @IsOptional()
  @IsBoolean()
  parkingViolationAlarm?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Alias for parkingViolationAlarm' })
  @IsOptional()
  @IsBoolean()
  parkAlarmOnIgnitionOn?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Relay / immobilize state — false=unlock, true=locked',
  })
  @IsOptional()
  @IsBoolean()
  lock?: boolean;

  // ── Custom fields (freeform jsonb) ────────────────────────────────

  @ApiPropertyOptional({ example: { department: 'logistics' } })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}
