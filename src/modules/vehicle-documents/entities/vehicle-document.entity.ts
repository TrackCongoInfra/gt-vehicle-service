import { Entity, Column, PrimaryColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

@Entity('vehicle_documents')
export class VehicleDocument {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'vehicle_id' })
  vehicleId: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @Column({ type: 'varchar', length: 50, name: 'doc_type' })
  docType: string;

  @Column({ type: 'varchar', length: 100, name: 'doc_number', nullable: true })
  docNumber: string;

  @Column({ type: 'date', name: 'issued_date', nullable: true })
  issuedDate: Date;

  @Column({ type: 'date', name: 'expiry_date', nullable: true })
  expiryDate: Date;

  @Column({ type: 'text', name: 'file_url', nullable: true })
  fileUrl: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;
}
