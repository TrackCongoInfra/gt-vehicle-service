import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Read-only reference to `public.devices`. Owned by gt-device-service.
 * We only SELECT from it here — never INSERT/UPDATE/DELETE — so that the
 * vehicles GET API can join and expose the assigned device's IMEI, SIM,
 * ignition-wire flags, etc.
 *
 * Only columns we actually read are declared. If the device service adds
 * new columns, no change is needed here.
 */
@Entity({ name: 'devices', schema: 'public' })
export class DeviceRef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 20 })
  imei: string;

  @Column({ name: 'd_type', type: 'varchar', length: 30 })
  dType: string;

  @Column({ name: 'device_status', type: 'varchar' })
  deviceStatus: string;

  @Column({ name: 'sim_number', type: 'varchar', length: 24, nullable: true })
  simNumber: string | null;

  @Column({ name: 'sim_provider', type: 'varchar', length: 50, nullable: true })
  simProvider: string | null;

  @Column({ name: 'firmware_version', type: 'varchar', length: 30, nullable: true })
  firmwareVersion: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer: string | null;

  @Column({ name: 'ign_wire', type: 'boolean', default: false })
  ignWire: boolean;

  @Column({ name: 'ign_wire_not_connected', type: 'boolean', default: false })
  ignWireNotConnected: boolean;

  @Column({ name: 'ac_wire', type: 'boolean', default: false })
  acWire: boolean;

  @Column({ type: 'boolean', default: false })
  assigned: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'current_vehicle_id', type: 'uuid', nullable: true })
  currentVehicleId: string | null;

  @Column({ name: 'last_heartbeat_at', type: 'timestamp', nullable: true })
  lastHeartbeatAt: Date | null;

  @Column({ name: 'phone_number', type: 'varchar', length: 20, nullable: true })
  phoneNumber: string | null;

  @Column({ name: 'vehicle_plate', type: 'varchar', length: 50, nullable: true })
  vehiclePlate: string | null;

  @Column({ name: 'installed_at', type: 'timestamp', nullable: true })
  installedAt: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
