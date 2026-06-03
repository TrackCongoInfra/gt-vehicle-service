import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds field-ops-related columns to the vehicles table for the GT AFRIK
 * Operations workflow (gt-field-ops-service).
 *
 * Columns added (additive only, no breaking changes):
 *   - customer_id            : owning customer (gt-field-ops-service.customers)
 *   - current_sim_id         : currently deployed SIM (gt-field-ops-service.sims)
 *   - installation_status    : pending | active | inactive | superseded
 *   - billing_status         : not_ready | ready | billed | suspended
 *   - billing_start_date     : date admin marked the install billing-ready
 *
 * Note: `current_device_id` already exists on the vehicles table (gt-vehicle-
 * service has long modelled the active device pairing). We do NOT redefine it.
 *
 * The new columns are nullable + un-indexed except for the plate-scan path
 * (idx_vehicles_plate already exists via vehicle_no). A partial index on
 * customer_id is added for the GT AFRIK "vehicles by customer" report.
 *
 * See gt-field-ops-service plan v2 §2.3.
 */
export class AddFieldOpsColumns1712700006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = (queryRunner.connection.options as any).schema || 'public';
    await queryRunner.query(`SET search_path TO "${schema}"`);

    await queryRunner.query(`
      ALTER TABLE vehicles
        ADD COLUMN IF NOT EXISTS customer_id           UUID NULL,
        ADD COLUMN IF NOT EXISTS current_sim_id        UUID NULL,
        ADD COLUMN IF NOT EXISTS installation_status   VARCHAR(30) NULL,
        ADD COLUMN IF NOT EXISTS billing_status        VARCHAR(30) NULL,
        ADD COLUMN IF NOT EXISTS billing_start_date    DATE        NULL
    `);

    // Partial index — most vehicles will have no customer_id during the
    // migration, and we only need the index to be fast for the "vehicles
    // by customer" lookup that gt-field-ops-service issues post-cutover.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id
        ON vehicles (customer_id)
        WHERE customer_id IS NOT NULL
    `);

    // Partial unique: one active install per plate per org. Repairs and
    // replacements don't trip this — they update in place rather than create
    // a parallel active row.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_active_install_per_org_plate
        ON vehicles (org_id, vehicle_no)
        WHERE installation_status = 'active' AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = (queryRunner.connection.options as any).schema || 'public';
    await queryRunner.query(`SET search_path TO "${schema}"`);

    await queryRunner.query(`DROP INDEX IF EXISTS uq_vehicles_active_install_per_org_plate`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_vehicles_customer_id`);

    await queryRunner.query(`
      ALTER TABLE vehicles
        DROP COLUMN IF EXISTS billing_start_date,
        DROP COLUMN IF EXISTS billing_status,
        DROP COLUMN IF EXISTS installation_status,
        DROP COLUMN IF EXISTS current_sim_id,
        DROP COLUMN IF EXISTS customer_id
    `);
  }
}
