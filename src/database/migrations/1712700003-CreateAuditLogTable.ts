import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogTable1712700003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_log (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id          UUID NOT NULL,
        user_id         UUID,
        action          VARCHAR(100) NOT NULL,
        entity_type     VARCHAR(100) NOT NULL,
        entity_id       UUID,
        old_value       JSONB,
        new_value       JSONB,
        ip_address      INET,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_org ON audit_log (org_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_user ON audit_log (user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_created ON audit_log (created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log;`);
  }
}
