import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableRlsAndTriggers1712700004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = ['vehicles', 'vehicle_documents', 'audit_log'];

    // Enable RLS on all tables
    for (const table of tables) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);

      const orgCol = table === 'vehicle_documents' ? 'organization_id' : 'org_id';

      await queryRunner.query(`
        CREATE POLICY org_isolation_${table} ON ${table}
          USING (${orgCol}::text = current_setting('app.current_org_id', TRUE));
      `);
    }

    // Create updated_at trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Apply updated_at trigger to vehicles (the only table with updated_at)
    await queryRunner.query(`
      CREATE TRIGGER trg_vehicles_updated_at
        BEFORE UPDATE ON vehicles
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON vehicles;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);

    const tables = ['vehicles', 'vehicle_documents', 'audit_log'];
    for (const table of tables) {
      await queryRunner.query(`DROP POLICY IF EXISTS org_isolation_${table} ON ${table};`);
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
    }
  }
}
