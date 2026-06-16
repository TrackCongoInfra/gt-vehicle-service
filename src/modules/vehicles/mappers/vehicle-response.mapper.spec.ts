import {
  mapVehicleToResponse,
  EnrichedVehicleRow,
} from './vehicle-response.mapper';
import { Vehicle } from '../entities/vehicle.entity';

/** Minimal enriched row — the mapper is null-safe for every other field. */
function rowWith(overrides: Partial<Vehicle>): EnrichedVehicleRow {
  return {
    vehicle: {
      id: 'v1',
      vehicleNo: 'TEST-01',
      mileage: 1,
      ...overrides,
    } as unknown as Vehicle,
    device: null,
    orgUser: null,
    transporter: null,
    organization: null,
  };
}

describe('mapVehicleToResponse — mileageKmL (configured rated km/L)', () => {
  it('returns the configured rated mileage as a number when set', () => {
    const res = mapVehicleToResponse(rowWith({ mileageKmpl: 12.5 }));
    expect(res.mileageKmL).toBe(12.5);
  });

  it('returns null when unset (NOT coerced to 0, so "not set" is distinguishable)', () => {
    const res = mapVehicleToResponse(rowWith({ mileageKmpl: null }));
    expect(res.mileageKmL).toBeNull();
  });

  it('coerces the TypeORM decimal string to a real number', () => {
    // TypeORM maps numeric/decimal columns to strings to preserve precision.
    const res = mapVehicleToResponse(
      rowWith({ mileageKmpl: '8.30' as unknown as number }),
    );
    expect(res.mileageKmL).toBe(8.3);
  });

  it('leaves the legacy `mileage` correction factor independent of mileageKmL', () => {
    const res = mapVehicleToResponse(rowWith({ mileage: 1, mileageKmpl: 10 }));
    expect(res.mileage).toBe(1);
    expect(res.mileageKmL).toBe(10);
  });
});
