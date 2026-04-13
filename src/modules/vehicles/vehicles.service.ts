import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Vehicle } from './entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { FilterVehicleDto } from './dto/filter-vehicle.dto';
import { AuditLog } from '../../shared/entities/audit-log.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async create(
    orgId: string,
    dto: CreateVehicleDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Vehicle> {
    const existing = await this.vehicleRepo.findOne({
      where: { orgId, vehicleNo: dto.vehicleNo, deletedAt: IsNull() },
    });

    if (existing) {
      throw new ConflictException(
        `Vehicle with number '${dto.vehicleNo}' already exists for this organization`,
      );
    }

    const vehicle = this.vehicleRepo.create({
      id: uuidv4(),
      orgId,
      ...dto,
    });

    const saved = await this.vehicleRepo.save(vehicle);

    await this.logAudit(orgId, userId, 'vehicle.created', 'vehicle', saved.id, null, saved, ipAddress);

    return saved;
  }

  async findAll(
    orgId: string,
    filter: FilterVehicleDto,
  ): Promise<{ data: Vehicle[]; meta: any }> {
    const query = this.vehicleRepo
      .createQueryBuilder('v')
      .where('v.org_id = :orgId', { orgId })
      .andWhere('v.deleted_at IS NULL');

    if (filter.vStatus) {
      query.andWhere('v.v_status = :vStatus', { vStatus: filter.vStatus });
    }

    if (filter.vType) {
      query.andWhere('v.v_type = :vType', { vType: filter.vType });
    }

    if (filter.search) {
      query.andWhere(
        '(v.vehicle_no ILIKE :search OR v.alias ILIKE :search OR v.make ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    const total = await query.getCount();
    const data = await query
      .orderBy('v.created_at', 'DESC')
      .skip((filter.page - 1) * filter.limit)
      .take(filter.limit)
      .getMany();

    return {
      data,
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: Math.ceil(total / filter.limit),
      },
    };
  }

  async findOne(orgId: string, id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id, orgId, deletedAt: IsNull() },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID '${id}' not found`);
    }

    return vehicle;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateVehicleDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Vehicle> {
    const vehicle = await this.findOne(orgId, id);
    const oldValue = { ...vehicle };

    // If changing vehicle number, check for duplicates
    if (dto.vehicleNo && dto.vehicleNo !== vehicle.vehicleNo) {
      const duplicate = await this.vehicleRepo.findOne({
        where: { orgId, vehicleNo: dto.vehicleNo, deletedAt: IsNull() },
      });
      if (duplicate) {
        throw new ConflictException(
          `Vehicle with number '${dto.vehicleNo}' already exists for this organization`,
        );
      }
    }

    Object.assign(vehicle, dto);
    const saved = await this.vehicleRepo.save(vehicle);

    await this.logAudit(orgId, userId, 'vehicle.updated', 'vehicle', id, oldValue, saved, ipAddress);

    return saved;
  }

  async remove(
    orgId: string,
    id: string,
    userId: string,
    ipAddress?: string,
  ): Promise<void> {
    const vehicle = await this.findOne(orgId, id);

    // Soft delete
    vehicle.deletedAt = new Date();
    await this.vehicleRepo.save(vehicle);

    await this.logAudit(orgId, userId, 'vehicle.deleted', 'vehicle', id, vehicle, null, ipAddress);
  }

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
    const log = this.auditLogRepo.create({
      id: uuidv4(),
      orgId,
      userId,
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      ipAddress,
    });
    await this.auditLogRepo.save(log);
  }
}
