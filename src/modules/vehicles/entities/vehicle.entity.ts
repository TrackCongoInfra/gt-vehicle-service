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

@Entity('vehicles')
@Unique('uq_vehicle_no_per_org', ['orgId', 'vehicleNo'])
export class Vehicle extends BaseOrgEntity {
  @Column({ type: 'varchar', length: 30, name: 'vehicle_no' })
  vehicleNo: string;

  @Column({ type: 'uuid', name: 'current_device_id', nullable: true })
  currentDeviceId: string;

  @Column({ type: 'varchar', name: 'v_type', default: 'other' })
  vType: string;

  @Column({ type: 'varchar', name: 'v_status', default: 'active' })
  vStatus: string;

  @Column({ type: 'varchar', name: 'connectivity_state', default: 'new' })
  connectivityState: string;

  @Column({ type: 'varchar', name: 'ignition_state', default: 'unknown' })
  ignitionState: string;

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

  @Column({ type: 'varchar', length: 50, name: 'vehicle_body', nullable: true })
  vehicleBody: string;

  @Column({ type: 'varchar', length: 150, name: 'owner_name', nullable: true })
  ownerName: string;

  @Column({ type: 'varchar', length: 50, name: 'owned_by', nullable: true })
  ownedBy: string;

  @Column({ type: 'decimal', precision: 8, scale: 1, nullable: true })
  capacity: number;

  @Column({ type: 'date', name: 'manufacture_date', nullable: true })
  manufactureDate: Date;

  @Column({ type: 'date', name: 'purchase_date', nullable: true })
  purchaseDate: Date;

  @Column({ type: 'decimal', precision: 6, scale: 1, name: 'fuel_tank_capacity_l', nullable: true })
  fuelTankCapacityL: number;

  @Column({ type: 'decimal', precision: 12, scale: 1, name: 'odometer_km', default: 0 })
  odometerKm: number;

  @Column({ type: 'decimal', precision: 10, scale: 1, name: 'engine_hours', default: 0 })
  engineHours: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  alias: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  operator: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, name: 'last_latitude', nullable: true })
  lastLatitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, name: 'last_longitude', nullable: true })
  lastLongitude: number;

  @Column({ type: 'decimal', precision: 6, scale: 1, name: 'last_speed_kmh', default: 0 })
  lastSpeedKmh: number;

  @Column({ type: 'smallint', name: 'last_heading', nullable: true })
  lastHeading: number;

  @Column({ type: 'text', name: 'last_address', nullable: true })
  lastAddress: string;

  @Column({ type: 'timestamp', name: 'last_data_at', nullable: true })
  lastDataAt: Date;

  @Column({ type: 'decimal', precision: 10, scale: 1, name: 'today_distance_km', default: 0 })
  todayDistanceKm: number;

  @Column({ type: 'decimal', precision: 12, scale: 1, name: 'total_distance_km', default: 0 })
  totalDistanceKm: number;

  @Column({ type: 'varchar', length: 10, name: 'el_lock_status', default: 'unlock' })
  elLockStatus: string;

  @Column({ type: 'varchar', length: 10, name: 'lock_status', default: 'unlock' })
  lockStatus: string;

  @Column({ type: 'boolean', name: 'panic_state', default: false })
  panicState: boolean;

  @Column({ type: 'smallint', name: 'speed_limit_kmh', default: 120 })
  speedLimitKmh: number;

  @Column({ type: 'smallint', name: 'idle_threshold_min', default: 5 })
  idleThresholdMin: number;

  @Column({ type: 'date', name: 'registration_expiry', nullable: true })
  registrationExpiry: Date;

  @Column({ type: 'date', name: 'insurance_expiry', nullable: true })
  insuranceExpiry: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'jsonb', name: 'custom_fields', nullable: true })
  customFields: Record<string, any>;

  @Column({ type: 'timestamp', name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
