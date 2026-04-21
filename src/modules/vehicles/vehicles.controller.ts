import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { FilterVehicleDto } from './dto/filter-vehicle.dto';
import { RequirePermissions, CurrentUser, CurrentOrg } from '@globaltracking/auth-middleware/nestjs';

@ApiTags('Vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @RequirePermissions('vehicles:create')
  @ApiOperation({ summary: 'Onboard a new vehicle' })
  @ApiResponse({ status: 201, description: 'Vehicle created successfully' })
  @ApiResponse({ status: 409, description: 'Vehicle number already exists' })
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Ip() ip: string,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehiclesService.create(orgId, dto, userId, ip);
  }

  @Get()
  @RequirePermissions('vehicles:read')
  @ApiOperation({
    summary: 'List vehicles (paginated, filterable by status/type/search)',
    description:
      'Returns enriched vehicle rows. Each item includes device block (imei/simNo/deviceType), ' +
      'subscription block (subscriptionStart/Due/autoRenewal), assigned user block, and ' +
      'organization fields (`orgName`, `organizationEmail`, `organizationPhone`). ' +
      'Note: the response field `companyName` was renamed to `orgName` in v1.1.0.',
  })
  @ApiResponse({ status: 200, description: 'Vehicles retrieved successfully' })
  findAll(@CurrentOrg() orgId: string, @Query() filter: FilterVehicleDto) {
    return this.vehiclesService.findAll(orgId, filter);
  }

  @Get(':id')
  @RequirePermissions('vehicles:read')
  @ApiOperation({
    summary: 'Get vehicle by ID',
    description:
      'Returns the enriched vehicle payload, identical in shape to each item returned by GET /vehicles ' +
      '(includes device, subscription, assigned user and organization blocks with `orgName`).',
  })
  @ApiResponse({ status: 200, description: 'Vehicle retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  findOne(
    @CurrentOrg() orgId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.vehiclesService.findOne(orgId, id);
  }

  @Patch(':id')
  @RequirePermissions('vehicles:update')
  @ApiOperation({ summary: 'Update a vehicle' })
  @ApiResponse({ status: 200, description: 'Vehicle updated successfully' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  @ApiResponse({ status: 409, description: 'Vehicle number already exists' })
  update(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Ip() ip: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(orgId, id, dto, userId, ip);
  }

  @Delete(':id')
  @RequirePermissions('vehicles:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a vehicle' })
  @ApiResponse({ status: 204, description: 'Vehicle deleted successfully' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  remove(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Ip() ip: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.vehiclesService.remove(orgId, id, userId, ip);
  }
}
