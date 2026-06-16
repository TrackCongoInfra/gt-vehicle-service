import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

/**
 * Field names that must be coerced from CSV strings ('true'/'false'/'1'/'0')
 * to native booleans before class-validator runs. CSV has no native boolean
 * type and `Boolean('false')` is `true` in JS, so we cannot rely on
 * class-transformer's implicit conversion alone.
 *
 * Keep this list in sync with @IsBoolean fields on CreateVehicleDto.
 */
const BOOLEAN_FIELDS = new Set([
  'autoRenewal',
  'parkingViolationAlarm',
  'parkAlarmOnIgnitionOn',
  'lock',
]);

/** Numeric fields on CreateVehicleDto. Coerced from CSV strings to numbers. */
const NUMBER_FIELDS = new Set([
  'year',
  'capacity',
  'fuelTankCapacityL',
  'speedLimitKmh',
  'overspeed',
  'idleThresholdMin',
  'mileage',
  'mileageKmL',
  'durationOdometer',
  'odometer',
  'odometerKm',
]);

function coerce(field: string, raw: unknown): unknown {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).trim();
  if (s === '') return undefined;

  if (BOOLEAN_FIELDS.has(field)) {
    const v = s.toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
    return s;
  }

  if (NUMBER_FIELDS.has(field)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : s;
  }

  return s;
}

/**
 * Parse a CSV text body into a `{ items: [...] }` shape ready for the
 * existing BulkCreateVehiclesDto validation pipeline.
 *
 * Header row is required and must use camelCase field names matching
 * CreateVehicleDto (e.g. `vehicleNo,vehicleType,make,model,year`).
 */
export function parseVehiclesCsv(body: string): { items: Record<string, unknown>[] } {
  if (!body || !body.trim()) {
    throw new BadRequestException('CSV body is empty');
  }

  let rows: Record<string, string>[];
  try {
    rows = parse(body, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: false,
    }) as Record<string, string>[];
  } catch (err) {
    throw new BadRequestException(
      `CSV parse error: ${(err as Error).message}`,
    );
  }

  if (rows.length === 0) {
    throw new BadRequestException('CSV has a header row but no data rows');
  }

  const items = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      const coerced = coerce(key, val);
      if (coerced !== undefined) out[key] = coerced;
    }
    return out;
  });

  return { items };
}
