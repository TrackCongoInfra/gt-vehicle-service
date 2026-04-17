import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { DeviceRef } from './entities/device.ref.entity';
import { OrganizationUserRef } from './entities/organization-user.ref.entity';
import { UserRef } from './entities/user.ref.entity';
import { OrganizationRef } from './entities/organization.ref.entity';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { AuditLog } from '../../shared/entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle,
      AuditLog,
      // Read-only references to tables owned by other services — SELECT only
      DeviceRef,
      OrganizationUserRef,
      UserRef,
      OrganizationRef,
    ]),
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
