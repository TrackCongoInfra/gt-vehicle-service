import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds field-ops-related columns to the vehicles table for the GT AFRIK
 * Operations workflow (gt-field-ops-service). Additive only — all columns
 * nullable, all DDL idempotent (IF NOT EXISTS).
 *
 *   - customer_id            : owning customer (gt-field-ops-service.customers)
 *   - current_sim_id         : currently deployed SIM (gt-field-ops-service.sims)
 *   - installation_status    : pending | active | inactive | superseded
 *   - billing_status         : not_ready | ready | billed | suspended
 *   - billing_start_date     : date admin marked the install billing-ready
 *
 * NOTE: the org column on `vehicles` is `organization_id` in this database
 * (renamed from the legacy `org_id`). The partial unique index therefore
 * references organization_id, NOT org_id.
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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id
        ON vehicles (customer_id)
        WHERE customer_id IS NOT NULL
    `);

    // Partial unique: one active install per plate per org. Repairs and
    // replacements update in place rather than create a parallel active row.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_active_install_per_org_plate
        ON vehicles (organization_id, vehicle_no)
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
