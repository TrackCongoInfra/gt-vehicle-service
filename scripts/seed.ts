import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  username: process.env.DB_USERNAME || 'gt_vehicle',
  password: process.env.DB_PASSWORD || 'gt_vehicle_secret',
  database: process.env.DB_DATABASE || 'gt_vehicle_db',
  synchronize: false,
  logging: true,
});

async function seed() {
  await dataSource.initialize();
  console.log('Connected to database');

  const orgId = '00000000-0000-0000-0000-000000000001';

  // Bypass RLS for seeding
  await dataSource.query(`SET app.current_org_id = '${orgId}'`);

  // Seed sample vehicles
  const vehicles = [
    {
      id: uuidv4(),
      org_id: orgId,
      vehicle_no: 'KBZ 100A',
      v_type: 'truck',
      v_status: 'active',
      make: 'TOYOTA',
      model: 'Hilux',
      year: 2023,
      color: 'White',
      owner_name: 'GeoSentry Fleet',
      owned_by: 'own',
      speed_limit_kmh: 100,
      alias: 'Hilux-01',
    },
    {
      id: uuidv4(),
      org_id: orgId,
      vehicle_no: 'KBZ 200B',
      v_type: 'sedan',
      v_status: 'active',
      make: 'SCANIA',
      model: 'R500',
      year: 2024,
      color: 'Blue',
      owner_name: 'GeoSentry Fleet',
      owned_by: 'leased',
      speed_limit_kmh: 120,
      alias: 'Scania-01',
    },
    {
      id: uuidv4(),
      org_id: orgId,
      vehicle_no: 'KBZ 300C',
      v_type: 'genset',
      v_status: 'active',
      make: 'CAT',
      model: 'C15',
      year: 2022,
      color: 'Yellow',
      owner_name: 'GeoSentry Fleet',
      owned_by: 'own',
      speed_limit_kmh: 0,
      alias: 'Genset-Site-A',
    },
  ];

  for (const v of vehicles) {
    await dataSource.query(
      `INSERT INTO vehicles (id, org_id, vehicle_no, v_type, v_status, make, model, year, color, owner_name, owned_by, speed_limit_kmh, alias)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (org_id, vehicle_no) DO NOTHING`,
      [v.id, v.org_id, v.vehicle_no, v.v_type, v.v_status, v.make, v.model, v.year, v.color, v.owner_name, v.owned_by, v.speed_limit_kmh, v.alias],
    );
    console.log(`Seeded vehicle: ${v.vehicle_no} (${v.alias})`);

    // Seed a registration document for each vehicle
    await dataSource.query(
      `INSERT INTO vehicle_documents (id, vehicle_id, organization_id, doc_type, doc_number, issued_date, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), v.id, orgId, 'registration', `REG-${v.vehicle_no}`, '2024-01-01', '2026-12-31'],
    );
    console.log(`  → Seeded registration document for ${v.vehicle_no}`);
  }

  console.log('\nSeed completed successfully!');
  console.log(`Organization ID: ${orgId}`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
