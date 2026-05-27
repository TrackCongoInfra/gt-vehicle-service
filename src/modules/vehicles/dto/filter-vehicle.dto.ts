import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { VehicleStatus, VehicleType } from '../entities/vehicle.entity';

/**
 * Normalise incoming enum query values. Enum values are stored lowercase
 * (e.g. 'active'), but clients often send `ACTIVE`, `Active`, or `active`
 * interchangeably. Lower-case before `@IsEnum` validates.
 */
const toLowerCaseValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * Normalise a multi-value query param into a clean string[]. Accepts both
 * `?ids=a,b,c` (comma-separated) and `?ids=a&ids=b` (repeated) shapes, plus
 * any combination. Empty entries are dropped.
 */
const toStringArray = ({ value }: { value: unknown }): unknown => {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const out = parts
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
};

/**
 * Mirrors the groups-service enum. `VEHICLE` narrows `entityId` against
 * the vehicle's assigned user (v.user_id); `TRANSPORTER` narrows against
 * the dedicated transporter column (v.transporter_id). Omitted ⇒ match
 * across user_id OR transporter_id OR organization_id.
 */
export enum VehicleAssignedTo {
  VEHICLE = 'VEHICLE',
  TRANSPORTER = 'TRANSPORTER',
  ORG = 'ORG',
}

export class FilterVehicleDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: VehicleStatus,
    description: 'Filter by status (case-insensitive — `ACTIVE`, `Active`, `active` all accepted)',
  })
  @IsOptional()
  @Transform(toLowerCaseValue)
  @IsEnum(VehicleStatus)
  vStatus?: VehicleStatus;

  @ApiPropertyOptional({
    enum: VehicleType,
    description: 'Filter by vehicle type (case-insensitive — `TRUCK`, `Truck`, `truck` all accepted)',
  })
  @IsOptional()
  @Transform(toLowerCaseValue)
  @IsEnum(VehicleType)
  vType?: VehicleType;

  @ApiPropertyOptional({ description: 'Search by vehicle number, owner name, owned by, vehicle brand, model, vehicle body, or alias' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by connectivity state' })
  @IsOptional()
  @IsString()
  connectivityState?: string;

  @ApiPropertyOptional({ description: 'Filter by ignition state' })
  @IsOptional()
  @IsString()
  ignitionState?: string;

  @ApiPropertyOptional({
    enum: VehicleAssignedTo,
    description:
      'Narrows the `entityId` match target. ' +
      '`VEHICLE` ⇒ match v.user_id (assigned user). ' +
      '`TRANSPORTER` ⇒ match v.transporter_id. ' +
      '`ORG` ⇒ match v.organization_id. ' +
      'Omitted ⇒ entityId matches any of the three columns.',
  })
  @IsOptional()
  @IsEnum(VehicleAssignedTo)
  assignedTo?: VehicleAssignedTo;

  @ApiPropertyOptional({
    description:
      'Return only vehicles that reference this UUID. By default matches against ' +
      'user_id, transporter_id, or organization_id. Use `assignedTo` to narrow to a ' +
      'single column.',
    format: 'uuid',
    example: '64813de9-ca32-485a-a15c-1c194de1efac',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by multiple organization IDs. Comma-separated (`?orgIds=a,b`) or ' +
      'repeated (`?orgIds=a&orgIds=b`). SYSTEM-ADMIN ONLY — ignored for non-admin ' +
      'callers, who are always scoped to their authenticated org.',
    type: [String],
    example: ['32d78f4c-ae34-4396-b65d-1175143da9e2'],
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsUUID(undefined, { each: true })
  orgIds?: string[];

  @ApiPropertyOptional({
    description:
      'Filter by multiple transporter user IDs (matches `vehicles.transporter_id`). ' +
      'Comma-separated or repeated.',
    type: [String],
    example: ['64813de9-ca32-485a-a15c-1c194de1efac'],
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsUUID(undefined, { each: true })
  transporterIds?: string[];

  @ApiPropertyOptional({
    description:
      'Filter by multiple group IDs. Matches vehicles whose assigned user ' +
      '(`vehicles.user_id`) belongs to any of these groups via ' +
      '`organization_users.group_id`. Comma-separated or repeated.',
    type: [String],
    example: ['11111111-1111-1111-1111-111111111111'],
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsUUID(undefined, { each: true })
  groupIds?: string[];

  @ApiPropertyOptional({
    description:
      'Filter by calendar month of `vehicles.created_at`. Format: `MM-yyyy` ' +
      '(zero-padded month, 4-digit year). Example: `04-2026` returns vehicles ' +
      'created in April 2026.',
    example: '04-2026',
    pattern: '^(0[1-9]|1[0-2])-(20\\d{2}|21\\d{2})$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])-(20\d{2}|21\d{2})$/, {
    message: 'monthYear must be in MM-yyyy format (e.g. 04-2026)',
  })
  monthYear?: string;
}
