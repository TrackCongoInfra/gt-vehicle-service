import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { VehicleStatus, VehicleType } from '../entities/vehicle.entity';

/**
 * Normalise incoming enum query values. Enum values are stored lowercase
 * (e.g. 'active'), but clients often send `ACTIVE`, `Active`, or `active`
 * interchangeably. Lower-case before `@IsEnum` validates.
 */
const toLowerCaseValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

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
    description:
      'Filter by transporter UUID — exact match on `vehicles.transporter_id`. ' +
      'Set the column per-vehicle via POST/PATCH (field `transporterId`).',
    format: 'uuid',
    example: '64813de9-ca32-485a-a15c-1c194de1efac',
  })
  @IsOptional()
  @IsUUID()
  transporterId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by organisation UUID — exact match on `vehicles.organization_id`. ' +
      'Useful for cross-org admin tooling; in normal org-scoped calls this is redundant ' +
      'because the API already filters to the caller\'s org.',
    format: 'uuid',
    example: 'dd8cf458-7b6f-4efc-a096-0680ad7995f3',
  })
  @IsOptional()
  @IsUUID()
  orgId?: string;
}
