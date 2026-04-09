import { Entity, Column, Unique } from 'typeorm';
import { BaseOrgEntity } from '../../../shared/entities/base-org.entity';

export enum VehicleType {
  SEDAN = 'sedan',
  SUV = 'suv',
  PICKUP = 'pickup',
  TRUCK = 'truck',
  BUS = 'bus',
  MOTORCYCLE = 'motorcycle',
  GENSET = 'genset',
  MACHINERY = 'machinery',
  TRAILER = 'trailer',
  OTHER = 'other',
}

export enum VehicleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  DECOMMISSIONED = 'decommissioned',
}

export enum OwnershipType {
  OWN = 'own',
  LEASED = 'leased',
  RENTED = 'rented',
}

@Entity('vehicles')
@Unique('uq_vehicle_no_per_org', ['orgId', 'vehicleNo'])
export class Vehicle extends BaseOrgEntity {
  @Column({ type: 'varchar', length: 30, name: 'vehicle_no' })
  vehicleNo: string;

  @Column({ type: 'uuid', name: 'current_device_id', nullable: true })
  currentDeviceId: string;

  @Column({
    type: 'enum',
    enum: VehicleType,
    name: 'v_type',
    default: VehicleType.OTHER,
  })
  vType: VehicleType;

  @Column({
    type: 'enum',
    enum: VehicleStatus,
    name: 'v_status',
    default: VehicleStatus.ACTIVE,
  })
  vStatus: VehicleStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  make: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  model: string;

  @Column({ type: 'smallint', nullable: true })
  year: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  color: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vin: string;

  @Column({ type: 'varchar', length: 50, name: 'engine_number', nullable: true })
  engineNumber: string;

  @Column({ type: 'varchar', length: 150, name: 'owner_name', nullable: true })
  ownerName: string;

  @Column({
    type: 'enum',
    enum: OwnershipType,
    name: 'owned_by',
    nullable: true,
  })
  ownedBy: OwnershipType;

  @Column({ type: 'uuid', name: 'operator_id', nullable: true })
  operatorId: string;

  @Column({ type: 'decimal', precision: 6, scale: 1, name: 'fuel_tank_capacity_l', nullable: true })
  fuelTankCapacityL: number;

  @Column({ type: 'date', name: 'manufacture_date', nullable: true })
  manufactureDate: Date;

  @Column({ type: 'date', name: 'purchase_date', nullable: true })
  purchaseDate: Date;

  @Column({ type: 'smallint', name: 'speed_limit_kmh', default: 120 })
  speedLimitKmh: number;

  @Column({ type: 'date', name: 'registration_expiry', nullable: true })
  registrationExpiry: Date;

  @Column({ type: 'date', name: 'insurance_expiry', nullable: true })
  insuranceExpiry: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  alias: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'jsonb', name: 'custom_fields', default: '{}' })
  customFields: Record<string, any>;

  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
