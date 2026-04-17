import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVehicleDocumentsTable1712700002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE vehicle_documents (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id        UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        organization_id   UUID NOT NULL,
        doc_type          VARCHAR(50) NOT NULL,
        doc_number        VARCHAR(100),
        issued_date       DATE,
        expiry_date       DATE,
        file_url          TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_vdocs_vehicle ON vehicle_documents (vehicle_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_vdocs_org ON vehicle_documents (organization_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_vdocs_expiry
        ON vehicle_documents (organization_id, expiry_date)
        WHERE expiry_date IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS vehicle_documents;`);
  }
}
