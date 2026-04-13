import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
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

export class CreateVehicleDto {
  @ApiProperty({ example: 'KBZ 123A', description: 'Vehicle registration number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  vehicleNo: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'Linked device ID' })
  @IsOptional()
  @IsUUID()
  currentDeviceId?: string;

  @ApiPropertyOptional({ enum: VehicleType, default: VehicleType.OTHER })
  @IsOptional()
  @IsEnum(VehicleType)
  vType?: VehicleType;

  @ApiPropertyOptional({ enum: VehicleStatus, default: VehicleStatus.ACTIVE })
  @IsOptional()
  @IsEnum(VehicleStatus)
  vStatus?: VehicleStatus;

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

  @ApiPropertyOptional({ example: 'Panel Van', description: 'Vehicle body type' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleBody?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  ownerName?: string;

  @ApiPropertyOptional({ example: 'company', description: 'Ownership type (company, leased, personal, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ownedBy?: string;

  @ApiPropertyOptional({ example: 5.0, description: 'Vehicle capacity (tons, seats, etc.)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  capacity?: number;

  @ApiPropertyOptional({ example: 'Driver Name', description: 'Assigned operator/driver name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  operator?: string;

  @ApiPropertyOptional({ example: 80.0, description: 'Fuel tank capacity in liters' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  fuelTankCapacityL?: number;

  @ApiPropertyOptional({ example: '2020-01-15' })
  @IsOptional()
  @IsString()
  manufactureDate?: string;

  @ApiPropertyOptional({ example: '2021-03-20' })
  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @ApiPropertyOptional({ example: 120, description: 'Speed limit in km/h' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  speedLimitKmh?: number;

  @ApiPropertyOptional({ example: 5, description: 'Idle threshold in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  idleThresholdMin?: number;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  registrationExpiry?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsString()
  insuranceExpiry?: string;

  @ApiPropertyOptional({ example: 'Site A Truck' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  alias?: string;

  @ApiPropertyOptional({ example: 'Assigned to Kinshasa depot' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ example: { department: 'logistics' } })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}
