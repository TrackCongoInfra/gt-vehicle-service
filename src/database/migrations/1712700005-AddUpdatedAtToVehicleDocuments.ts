import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The production `vehicle_documents` table already has `updated_at`
 * (timestamptz NOT NULL DEFAULT now()) but the original
 * 1712700002 migration didn't create it. This patch is idempotent —
 * safe to run on prod (no-op) and gives fresh dev DBs the right shape.
 */
export class AddUpdatedAtToVehicleDocuments1712700005
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.vehicle_documents
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    `);

    // Keep updated_at in sync on UPDATE (matches the trigger pattern used
    // for vehicles in 1712700004).
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_vehicle_documents_updated_at
        ON public.vehicle_documents;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_vehicle_documents_updated_at
        BEFORE UPDATE ON public.vehicle_documents
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_vehicle_documents_updated_at
        ON public.vehicle_documents;
    `);
    await queryRunner.query(`
      ALTER TABLE public.vehicle_documents
        DROP COLUMN IF EXISTS updated_at;
    `);
  }
}
