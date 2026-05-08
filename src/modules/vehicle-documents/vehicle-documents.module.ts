import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleDocument } from './entities/vehicle-document.entity';
import { VehicleDocumentsController } from './vehicle-documents.controller';
import { VehicleDocumentsService } from './vehicle-documents.service';
import { VehicleDocumentsStorage } from './vehicle-documents.storage';
import { AuditLog } from '../../shared/entities/audit-log.entity';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleDocument, AuditLog]),
    VehiclesModule,
  ],
  controllers: [VehicleDocumentsController],
  providers: [VehicleDocumentsService, VehicleDocumentsStorage],
  exports: [VehicleDocumentsService],
})
export class VehicleDocumentsModule {}
