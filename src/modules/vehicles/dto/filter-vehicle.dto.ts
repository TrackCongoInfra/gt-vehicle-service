import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
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

  @ApiPropertyOptional({ description: 'Search by vehicle number, owner name, owned by, vehicle brand, model, vehicle body, alias, or transporter' })
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
      'Filter by the month component (1–12) of `vehicles.created_at`. Combine with ' +
      '`year` to scope to a specific calendar month.',
    minimum: 1,
    maximum: 12,
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    description:
      'Filter by the year component of `vehicles.created_at` (>= 2000). Can be used ' +
      'alone (whole-year filter) or together with `month`.',
    minimum: 2000,
    maximum: 2100,
    example: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
