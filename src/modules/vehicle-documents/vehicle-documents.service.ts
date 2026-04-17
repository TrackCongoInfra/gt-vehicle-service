import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VehicleDocument } from './entities/vehicle-document.entity';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import { UpdateVehicleDocumentDto } from './dto/update-vehicle-document.dto';
import { AuditLog } from '../../shared/entities/audit-log.entity';
import { VehiclesService } from '../vehicles/vehicles.service';

@Injectable()
export class VehicleDocumentsService {
  private readonly logger = new Logger(VehicleDocumentsService.name);

  constructor(
    @InjectRepository(VehicleDocument)
    private readonly docRepo: Repository<VehicleDocument>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async create(
    orgId: string,
    vehicleId: string,
    dto: CreateVehicleDocumentDto,
    userId: string,
    ipAddress?: string,
  ): Promise<VehicleDocument> {
    // Verify vehicle exists and belongs to org
    await this.vehiclesService.findOne(orgId, vehicleId);

    const doc = this.docRepo.create({
      id: uuidv4(),
      vehicleId,
      organizationId: orgId,
      ...dto,
    });

    const saved = await this.docRepo.save(doc);

    this.logger.log(`Document created: ${saved.id} type=${dto.docType} vehicle=${vehicleId}`);

    await this.logAudit(orgId, userId, 'vdoc.created', 'vehicle_document', saved.id, null, saved, ipAddress);

    return saved;
  }

  async findAllByVehicle(
    orgId: string,
    vehicleId: string,
  ): Promise<VehicleDocument[]> {
    // Verify vehicle exists and belongs to org
    await this.vehiclesService.findOne(orgId, vehicleId);

    return this.docRepo.find({
      where: { vehicleId, organizationId: orgId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    orgId: string,
    vehicleId: string,
    docId: string,
  ): Promise<VehicleDocument> {
    const doc = await this.docRepo.findOne({
      where: { id: docId, vehicleId, organizationId: orgId },
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID '${docId}' not found`);
    }

    return doc;
  }

  async update(
    orgId: string,
    vehicleId: string,
    docId: string,
    dto: UpdateVehicleDocumentDto,
    userId: string,
    ipAddress?: string,
  ): Promise<VehicleDocument> {
    const doc = await this.findOne(orgId, vehicleId, docId);
    const oldValue = { ...doc };

    Object.assign(doc, dto);
    const saved = await this.docRepo.save(doc);

    this.logger.log(`Document updated: ${docId}`);

    await this.logAudit(orgId, userId, 'vdoc.updated', 'vehicle_document', docId, oldValue, saved, ipAddress);

    return saved;
  }

  async remove(
    orgId: string,
    vehicleId: string,
    docId: string,
    userId: string,
    ipAddress?: string,
  ): Promise<void> {
    const doc = await this.findOne(orgId, vehicleId, docId);

    await this.docRepo.remove(doc);

    this.logger.log(`Document deleted: ${docId}`);

    await this.logAudit(orgId, userId, 'vdoc.deleted', 'vehicle_document', docId, doc, null, ipAddress);
  }

  /**
   * Append-only audit log with exponential backoff retry.
   * Fire-and-forget — never throws to the caller.
   */
  private async logAudit(
    orgId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValue: any,
    newValue: any,
    ipAddress?: string,
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const entry = this.auditLogRepo.create({
          userId,
          transporterId: orgId,
          action,
          entityType,
          entityId,
          changes: {
            old: oldValue ?? null,
            new: newValue ?? null,
          },
          ipAddress: ipAddress ?? null,
        } as AuditLog);

        await this.auditLogRepo.save(entry);
        return;
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) {
          this.logger.error(
            `Failed to write audit log after ${maxRetries} attempts: ${(err as Error).message}`,
            (err as Error).stack,
          );
          return; // Fire-and-forget: don't throw
        }
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = 100 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
