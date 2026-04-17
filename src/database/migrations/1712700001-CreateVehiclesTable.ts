import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVehiclesTable1712700001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE vehicle_type AS ENUM (
        'sedan', 'suv', 'pickup', 'truck', 'bus', 'motorcycle',
        'genset', 'machinery', 'trailer', 'other'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE vehicle_status AS ENUM (
        'active', 'inactive', 'maintenance', 'decommissioned'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE ownership_type AS ENUM (
        'own', 'leased', 'rented'
      );
    `);

    // Create vehicles table
    await queryRunner.query(`
      CREATE TABLE vehicles (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id                UUID NOT NULL,
        vehicle_no            VARCHAR(30) NOT NULL,
        current_device_id     UUID,

        v_type                vehicle_type NOT NULL DEFAULT 'other',
        v_status              vehicle_status NOT NULL DEFAULT 'active',

        make                  VARCHAR(50),
        model                 VARCHAR(50),
        year                  SMALLINT,
        color                 VARCHAR(30),
        vin                   VARCHAR(50),
        engine_number         VARCHAR(50),

        owner_name            VARCHAR(150),
        owned_by              ownership_type,
        operator_id           UUID,

        fuel_tank_capacity_l  DECIMAL(6,1),
        manufacture_date      DATE,
        purchase_date         DATE,

        speed_limit_kmh       SMALLINT DEFAULT 120,

        registration_expiry   DATE,
        insurance_expiry      DATE,

        alias                 VARCHAR(50),
        remarks               TEXT,
        custom_fields         JSONB DEFAULT '{}',

        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW(),
        deleted_at            TIMESTAMPTZ,

        CONSTRAINT uq_vehicle_no_per_org UNIQUE (org_id, vehicle_no)
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX idx_vehicles_org_id ON vehicles (org_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_vehicles_org_status ON vehicles (org_id, v_status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS vehicles;`);
    await queryRunner.query(`DROP TYPE IF EXISTS ownership_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS vehicle_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS vehicle_type;`);
  }
}
