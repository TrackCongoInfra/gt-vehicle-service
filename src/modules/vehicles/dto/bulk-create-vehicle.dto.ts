import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto';

export const BULK_VEHICLE_LIMIT = 500;

export class BulkCreateVehiclesDto {
  @ApiProperty({
    type: () => CreateVehicleDto,
    isArray: true,
    description: `Array of vehicles to create. Each item follows the standard CreateVehicleDto. Max ${BULK_VEHICLE_LIMIT} items per request.`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_VEHICLE_LIMIT, {
    message: `items must contain at most ${BULK_VEHICLE_LIMIT} entries`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateVehicleDto)
  items: CreateVehicleDto[];
}

export class BulkCreateVehicleResultRowDto {
  @ApiProperty({ example: 0, description: '0-based index of the row in the request items array' })
  index: number;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    required: false,
    description: 'Created vehicle payload (only present when success is true)',
  })
  data?: unknown;

  @ApiProperty({
    required: false,
    example: "Vehicle with number 'N3-DORKAS' already exists for this organization",
    description: 'Error message (only present when success is false)',
  })
  error?: string;

  @ApiProperty({
    required: false,
    example: 409,
    description: 'HTTP status that would have been returned for this row',
  })
  statusCode?: number;
}

export class BulkCreateVehiclesResponseDto {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 97 })
  succeeded: number;

  @ApiProperty({ example: 3 })
  failed: number;

  @ApiProperty({ type: () => BulkCreateVehicleResultRowDto, isArray: true })
  results: BulkCreateVehicleResultRowDto[];
}
