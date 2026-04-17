import { PartialType } from '@nestjs/swagger';
import { CreateVehicleDto } from './create-vehicle.dto';

/**
 * Every field accepted on create is also accepted on update — all optional.
 * The service's `update()` applies the same alias → canonical mapping
 * logic as `create()`, so callers can use `overspeed`, `odometer`,
 * `extraRemark`, `parkAlarmOnIgnitionOn`, `lock`, etc. interchangeably with
 * their canonical counterparts.
 */
export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
