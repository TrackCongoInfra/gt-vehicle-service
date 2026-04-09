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
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VehicleDocumentsService } from './vehicle-documents.service';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import { UpdateVehicleDocumentDto } from './dto/update-vehicle-document.dto';
import { RequirePermissions, CurrentUser, CurrentOrg } from '@globaltracking/auth-middleware/nestjs';

@ApiTags('Vehicle Documents')
@Controller('vehicles/:vehicleId/documents')
export class VehicleDocumentsController {
  constructor(private readonly docsService: VehicleDocumentsService) {}

  @Post()
  @RequirePermissions('vehicle_documents:create')
  @ApiOperation({ summary: 'Add a document to a vehicle' })
  @ApiResponse({ status: 201, description: 'Document created successfully' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Ip() ip: string,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Body() dto: CreateVehicleDocumentDto,
  ) {
    return this.docsService.create(orgId, vehicleId, dto, userId, ip);
  }

  @Get()
  @RequirePermissions('vehicle_documents:read')
  @ApiOperation({ summary: 'List all documents for a vehicle' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  findAll(
    @CurrentOrg() orgId: string,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
  ) {
    return this.docsService.findAllByVehicle(orgId, vehicleId);
  }

  @Get(':docId')
  @RequirePermissions('vehicle_documents:read')
  @ApiOperation({ summary: 'Get a specific document' })
  @ApiResponse({ status: 200, description: 'Document retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  findOne(
    @CurrentOrg() orgId: string,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Param('docId', new ParseUUIDPipe()) docId: string,
  ) {
    return this.docsService.findOne(orgId, vehicleId, docId);
  }

  @Patch(':docId')
  @RequirePermissions('vehicle_documents:update')
  @ApiOperation({ summary: 'Update a document' })
  @ApiResponse({ status: 200, description: 'Document updated successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  update(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Ip() ip: string,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @Body() dto: UpdateVehicleDocumentDto,
  ) {
    return this.docsService.update(orgId, vehicleId, docId, dto, userId, ip);
  }

  @Delete(':docId')
  @RequirePermissions('vehicle_documents:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 204, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  remove(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Ip() ip: string,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Param('docId', new ParseUUIDPipe()) docId: string,
  ) {
    return this.docsService.remove(orgId, vehicleId, docId, userId, ip);
  }
}
