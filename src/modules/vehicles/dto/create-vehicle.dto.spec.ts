import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto';

/** Validate a payload and report whether `mileageKmL` specifically errored. */
async function mileageKmLErrors(payload: Record<string, unknown>): Promise<boolean> {
  const dto = plainToInstance(CreateVehicleDto, payload);
  const errs = await validate(dto);
  return errs.some((e) => e.property === 'mileageKmL');
}

describe('CreateVehicleDto — mileageKmL validation', () => {
  it('accepts a valid positive 2-decimal value', async () => {
    expect(await mileageKmLErrors({ mileageKmL: 12.5 })).toBe(false);
  });

  it('accepts the field being omitted (optional)', async () => {
    expect(await mileageKmLErrors({})).toBe(false);
  });

  it('accepts explicit null (clear) via @IsOptional', async () => {
    expect(await mileageKmLErrors({ mileageKmL: null })).toBe(false);
  });

  it('rejects 0 — a meaningless rated mileage (would divide-by-zero downstream)', async () => {
    expect(await mileageKmLErrors({ mileageKmL: 0 })).toBe(true);
  });

  it('rejects a negative value', async () => {
    expect(await mileageKmLErrors({ mileageKmL: -5 })).toBe(true);
  });

  it('rejects a value above the 999.99 cap', async () => {
    expect(await mileageKmLErrors({ mileageKmL: 1000 })).toBe(true);
  });

  it('rejects more than 2 decimal places', async () => {
    expect(await mileageKmLErrors({ mileageKmL: 12.999 })).toBe(true);
  });
});
