import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VehicleStatus, VehicleType } from '../entities/vehicle.entity';

export class UpdateVehicleDto {
  @ApiPropertyOptional({ example: 'KBZ 456B' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  vehicleNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currentDeviceId?: string;

  @ApiPropertyOptional({ enum: VehicleType })
  @IsOptional()
  @IsEnum(VehicleType)
  vType?: VehicleType;

  @ApiPropertyOptional({ enum: VehicleStatus })
  @IsOptional()
  @IsEnum(VehicleStatus)
  vStatus?: VehicleStatus;

  @ApiPropertyOptional({ example: 'SCANIA' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  make?: string;

  @ApiPropertyOptional({ example: 'R500' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  model?: string;

  @ApiPropertyOptional({ example: 2025 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: 'Blue' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  engineNumber?: string;

  @ApiPropertyOptional({ example: 'Panel Van' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleBody?: string;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  fuelTankCapacityL?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufactureDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  speedLimitKmh?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  idleThresholdMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insuranceExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  alias?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}
