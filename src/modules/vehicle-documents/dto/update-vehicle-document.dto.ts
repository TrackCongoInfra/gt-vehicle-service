import { PartialType } from '@nestjs/swagger';
import { CreateVehicleDocumentDto } from './create-vehicle-document.dto';

export class UpdateVehicleDocumentDto extends PartialType(
  CreateVehicleDocumentDto,
) {}
