import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentOrg,
  CurrentUser,
  RequirePermissions,
} from '@globaltracking/auth-middleware/nestjs';
import { VehicleDocumentsService } from './vehicle-documents.service';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import { UpdateVehicleDocumentDto } from './dto/update-vehicle-document.dto';

const TEN_MB = 10 * 1024 * 1024;

@ApiTags('Vehicle Documents')
@Controller('vehicles/:vehicleId/documents')
export class VehicleDocumentsController {
  constructor(private readonly docsService: VehicleDocumentsService) {}

  @Post()
  @RequirePermissions('vehicle_documents:create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TEN_MB } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Multipart form. `file` is the document binary (optional, max 10 MB). All other fields are the document metadata. ' +
      'When `file` is present it is uploaded to the gt-vehicle-document GCS bucket and the resulting URL overrides any `fileUrl` field.',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        docType: { type: 'string', example: 'registration' },
        docNumber: { type: 'string', example: 'REG-2024-12345' },
        issuedDate: { type: 'string', example: '01/01/2024' },
        expiryDate: { type: 'string', example: '31/12/2027' },
        fileUrl: {
          type: 'string',
          example: 'https://example.com/docs/reg-123.pdf',
          description: 'Ignored when `file` is uploaded.',
        },
      },
      required: ['docType'],
    },
  })
  @ApiOperation({
    summary: 'Add a document to a vehicle (multipart, optional file upload)',
  })
  @ApiResponse({ status: 201, description: 'Document created successfully' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  @ApiResponse({ status: 413, description: 'File exceeds 10 MB limit' })
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Ip() ip: string,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .build({ fileIsRequired: false }),
    )
    file: Express.Multer.File | undefined,
    @Body() dto: CreateVehicleDocumentDto,
  ) {
    return this.docsService.create(orgId, vehicleId, dto, userId, ip, file);
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
  @ApiOperation({ summary: 'Update a document (metadata only, JSON body)' })
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
