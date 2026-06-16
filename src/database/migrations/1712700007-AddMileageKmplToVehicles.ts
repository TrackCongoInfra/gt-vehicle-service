import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `mileage_kmpl` — the operator-configured rated fuel mileage (km/L) of a
 * vehicle. Distinct from the existing `mileage` column (a correction factor,
 * default 1): this is the vehicle's *stated* km/L, used to surface mileage for
 * vehicles WITHOUT a BLE fuel sensor, where actual consumption cannot be
 * measured. Operator-entered on create/update; NULL = not set (UI shows "—").
 *
 * Additive and idempotent (IF NOT EXISTS). `migrationsRun` is false in this
 * service, so this is applied deliberately to the live DB (public.vehicles),
 * never auto-run on deploy.
 */
export class AddMileageKmplToVehicles1712700007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = (queryRunner.connection.options as any).schema || 'public';
    await queryRunner.query(`SET search_path TO "${schema}"`);

    await queryRunner.query(`
      ALTER TABLE vehicles
        ADD COLUMN IF NOT EXISTS mileage_kmpl NUMERIC(6,2) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = (queryRunner.connection.options as any).schema || 'public';
    await queryRunner.query(`SET search_path TO "${schema}"`);

    await queryRunner.query(`
      ALTER TABLE vehicles
        DROP COLUMN IF EXISTS mileage_kmpl
    `);
  }
}
