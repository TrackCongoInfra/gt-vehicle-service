import { Entity, Column, Unique } from 'typeorm';
import { BaseOrgEntity } from '../../../shared/entities/base-org.entity';

export enum VehicleType {
  // Original PG enum values
  TRUCK = 'truck',
  CAR = 'car',
  BUS = 'bus',
  MOTORCYCLE = 'motorcycle',
  GENSET = 'genset',
  MACHINERY = 'machinery',
  TRAILER = 'trailer',
  OTHER = 'other',
  // Expanded set (added via ALTER TYPE vehicle_type ADD VALUE …)
  SONOGRAPHIC = 'sonographic',
  JEEP = 'jeep',
  TEMPO = 'tempo',
  TRACTOR = 'tractor',
  PERSONAL_CAR = 'personal_car',
  TAXI = 'taxi',
  BIKE = 'bike',
  SCHOOL_BUS = 'school_bus',
  PUBLIC_BUS = 'public_bus',
  AMBULANCE = 'ambulance',
  THREE_WHEELER = '3_wheeler',
  TANKER = 'tanker',
  GARBAGE = 'garbage',
  DUMPER = 'dumper',
  MIXER = 'mixer',
  CRANE = 'crane',
  BULLDOZER = 'bulldozer',
  ASSET = 'asset',
  MOBILE = 'mobile',
  SCOOTY = 'scooty',
  PERSON = 'person',
  PET = 'pet',
  MPV = 'mpv',
  TRAVELLER = 'traveller',
  BICYCLE = 'bicycle',
  SUV = 'suv',
  PICKUP = 'pickup',
  E_BIKE = 'e_bike',
  ALS = 'als',
  HVV = 'hvv',
  NNV = 'nnv',
  FR = 'fr',
  DBV = 'dbv',
  CCA = 'cca',
  FORKLIFT = 'forklift',
  ROAD_ROLLER = 'road_roller',
  JCB = 'jcb',
  SERVICE_VAN = 'service_van',
  BOAT = 'boat',
  HARVESTER = 'harvester',
  E_LOCK = 'e_lock',
  FIRETRUCK = 'firetruck',
  LOCOMOTIVE = 'locomotive',
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

  @Column({ type: 'varchar', length: 150, nullable: true })
  transporter: string | null;

  @Column({ type: 'uuid', name: 'current_device_id', nullable: true })
  currentDeviceId: string | null;

  // Owner / assigned user (subscription details live on organization_users for this user)
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  // Dedicated transporter reference — UUID of the user acting as the
  // transporter for this vehicle. Independent of user_id (the assigned
  // user) so a vehicle can be assigned to one user but transported by
  // another. Filtered via ?transporter= on GET /vehicles.
  @Column({ type: 'uuid', name: 'transporter_id', nullable: true })
  transporterId: string | null;

  @Column({ type: 'varchar', name: 'v_type', default: 'other' })
  vType: string;

  @Column({ type: 'varchar', name: 'v_status', default: 'active' })
  vStatus: string;

  @Column({ type: 'varchar', name: 'connectivity_state', default: 'new' })
  connectivityState: string;

  @Column({ type: 'varchar', name: 'ignition_state', default: 'unknown' })
  ignitionState: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  make: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  model: string | null;

  @Column({ type: 'smallint', nullable: true })
  year: number | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vin: string | null;

  @Column({ type: 'varchar', length: 50, name: 'engine_number', nullable: true })
  engineNumber: string | null;

  @Column({ type: 'varchar', length: 50, name: 'vehicle_body', nullable: true })
  vehicleBody: string | null;

  @Column({ type: 'varchar', length: 150, name: 'owner_name', nullable: true })
  ownerName: string | null;

  @Column({ type: 'varchar', length: 50, name: 'owned_by', nullable: true })
  ownedBy: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 1, nullable: true })
  capacity: number | null;

  @Column({ type: 'date', name: 'manufacture_date', nullable: true })
  manufactureDate: Date | null;

  @Column({ type: 'date', name: 'purchase_date', nullable: true })
  purchaseDate: Date | null;

  @Column({ type: 'decimal', precision: 6, scale: 1, name: 'fuel_tank_capacity_l', nullable: true })
  fuelTankCapacityL: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 1, name: 'odometer_km', default: 0 })
  odometerKm: number;

  @Column({ type: 'decimal', precision: 10, scale: 1, name: 'engine_hours', default: 0 })
  engineHours: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  alias: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  operator: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, name: 'last_latitude', nullable: true })
  lastLatitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, name: 'last_longitude', nullable: true })
  lastLongitude: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 1, name: 'last_speed_kmh', default: 0 })
  lastSpeedKmh: number;

  @Column({ type: 'smallint', name: 'last_heading', nullable: true })
  lastHeading: number | null;

  @Column({ type: 'text', name: 'last_address', nullable: true })
  lastAddress: string | null;

  @Column({ type: 'timestamp', name: 'last_data_at', nullable: true })
  lastDataAt: Date | null;

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
  registrationExpiry: Date | null;

  @Column({ type: 'date', name: 'insurance_expiry', nullable: true })
  insuranceExpiry: Date | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  // ── New form fields ──────────────────────────────────────

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 1 })
  mileage: number;

  @Column({ type: 'varchar', length: 30, name: 'fuel_type', nullable: true })
  fuelType: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 1, name: 'duration_odometer', nullable: true })
  durationOdometer: number | null;

  @Column({ type: 'text', name: 'remarks_2', nullable: true })
  remarks2: string | null;

  @Column({ type: 'boolean', name: 'parking_violation_alarm', default: false })
  parkingViolationAlarm: boolean;

  // Freeform coin identifier shown in UI, e.g. "bL1gYhJ (11/05/2026)".
  // Coin lifecycle is managed externally — we only hold the label.
  @Column({ type: 'varchar', length: 100, name: 'attached_coin', nullable: true })
  attachedCoin: string | null;

  // ── Standard fields ──────────────────────────────────────

  @Column({ type: 'jsonb', name: 'custom_fields', nullable: true })
  customFields: Record<string, any> | null;

  @Column({ type: 'timestamp', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
