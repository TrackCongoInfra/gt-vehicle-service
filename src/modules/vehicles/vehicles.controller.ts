import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MaintenanceGuard } from '../../shared/org-settings/maintenance.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import type { Request } from 'express';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { FilterVehicleDto } from './dto/filter-vehicle.dto';
import {
  BulkCreateVehiclesDto,
  BulkCreateVehiclesResponseDto,
} from './dto/bulk-create-vehicle.dto';
import { parseVehiclesCsv } from './dto/csv-to-vehicles.util';
import { RequirePermissions, CurrentUser, CurrentOrg } from '@globaltracking/auth-middleware/nestjs';

@ApiTags('Vehicles')
@ApiExtraModels(CreateVehicleDto, BulkCreateVehiclesDto)
@Controller('vehicles')
@UseGuards(MaintenanceGuard)
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

  @Post('bulk/:orgId')
  @RequirePermissions('vehicles:create')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Bulk-create vehicles for an org (JSON, raw CSV, or file upload — partial success)',
    description:
      'Create up to 500 vehicles in one request for the org named in the path. ' +
      'Path orgId must match the caller\'s authenticated org (system admins may target any org). ' +
      'Accepts `{ items: [...] }` JSON, raw text/csv body, OR multipart/form-data with a `file` field. ' +
      'Each item is validated and inserted independently — a failure on one row ' +
      'does NOT roll back the others. Response includes per-row success/error with the original 0-based index.',
  })
  @ApiParam({ name: 'orgId', type: 'string', format: 'uuid' })
  @ApiConsumes('application/json', 'text/csv', 'multipart/form-data')
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(BulkCreateVehiclesDto) },
        { type: 'string', description: 'Raw CSV body when Content-Type is text/csv' },
        {
          type: 'object',
          description: 'Multipart form with a `file` field carrying the .csv',
          properties: { file: { type: 'string', format: 'binary' } },
          required: ['file'],
        },
      ],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk insert completed. Inspect `results` for per-row status.',
    type: BulkCreateVehiclesResponseDto,
  })
  @ApiResponse({ status: 400, description: 'DTO validation failed (e.g. > 500 items, malformed payload).' })
  @ApiResponse({ status: 403, description: 'Path orgId does not match caller\'s org' })
  async bulkCreate(
    @Param('orgId', ParseUUIDPipe) pathOrgId: string,
    @CurrentOrg() currentOrgId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('isSystemAdmin') callerIsSystemAdmin: boolean | undefined,
    @Ip() ip: string,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (pathOrgId !== currentOrgId && callerIsSystemAdmin !== true) {
      throw new ForbiddenException(
        `Path orgId "${pathOrgId}" does not match your authenticated org`,
      );
    }

    const contentType = (req.headers['content-type'] || '').toLowerCase();
    const isCsv =
      contentType.startsWith('text/csv') || contentType.startsWith('application/csv');
    const isMultipart = contentType.startsWith('multipart/form-data');

    let dto: BulkCreateVehiclesDto;
    if (isMultipart) {
      if (!file) {
        throw new BadRequestException(
          'multipart/form-data upload requires a `file` field carrying the .csv',
        );
      }
      const csvText = file.buffer.toString('utf8');
      dto = await this.validateBody(BulkCreateVehiclesDto, parseVehiclesCsv(csvText));
    } else if (isCsv) {
      if (typeof body !== 'string') {
        throw new BadRequestException(
          'CSV upload requires Content-Type: text/csv with a raw text body',
        );
      }
      dto = await this.validateBody(BulkCreateVehiclesDto, parseVehiclesCsv(body));
    } else {
      // Tolerate a bare JSON array ([...]) in addition to { items: [...] }.
      const normalized = Array.isArray(body) ? { items: body } : body;
      dto = await this.validateBody(BulkCreateVehiclesDto, normalized);
    }

    return this.vehiclesService.bulkCreate(pathOrgId, dto.items, userId, ip);
  }

  private async validateBody<T extends object>(
    cls: new () => T,
    body: unknown,
  ): Promise<T> {
    const dto = plainToInstance(cls, body, { enableImplicitConversion: true });
    const errors = await validate(dto as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new BadRequestException(flattenValidationErrors(errors));
    }
    return dto;
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
  findAll(
    @CurrentOrg() orgId: string,
    @CurrentUser('isSystemAdmin') isSystemAdmin: boolean | undefined,
    @Query() filter: FilterVehicleDto,
  ) {
    return this.vehiclesService.findAll(orgId, filter, isSystemAdmin === true);
  }

  @Get('by-plate')
  @RequirePermissions('vehicles:read')
  @ApiOperation({
    summary: 'Look up a vehicle by plate (case-insensitive)',
    description:
      'Used by the GT AFRIK Operations technician scan flow (gt-field-ops-service) ' +
      "during the installation workflow. Returns the enriched vehicle payload if a row " +
      "exists in the caller's org with the given plate, or null. Declared above " +
      'GET /:id so the route matches `by-plate` literally rather than being parsed as a UUID.',
  })
  @ApiResponse({ status: 200, description: 'Vehicle (or null) returned' })
  findByPlate(@CurrentOrg() orgId: string, @Query('plate') plate: string) {
    if (!plate || !plate.trim()) {
      throw new BadRequestException('Query parameter `plate` is required');
    }
    return this.vehiclesService.findByPlate(orgId, plate);
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

function flattenValidationErrors(errors: ValidationError[]): string[] {
  const out: string[] = [];
  const walk = (errs: ValidationError[], prefix: string) => {
    for (const err of errs) {
      const path = prefix ? `${prefix}.${err.property}` : err.property;
      if (err.constraints) {
        for (const msg of Object.values(err.constraints)) {
          out.push(msg.startsWith(err.property) ? `${prefix ? prefix + '.' : ''}${msg}` : `${path} ${msg}`);
        }
      }
      if (err.children?.length) walk(err.children, path);
    }
  };
  walk(errors, '');
  return out;
}
