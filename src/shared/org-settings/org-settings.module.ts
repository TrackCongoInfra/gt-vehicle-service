import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationSettingsRef } from './organization-settings-ref.entity';
import { OrgSettingsReaderService } from './org-settings-reader.service';
import { MaintenanceGuard } from './maintenance.guard';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationSettingsRef])],
  providers: [OrgSettingsReaderService, MaintenanceGuard],
  exports: [OrgSettingsReaderService, MaintenanceGuard],
})
export class OrgSettingsModule {}
