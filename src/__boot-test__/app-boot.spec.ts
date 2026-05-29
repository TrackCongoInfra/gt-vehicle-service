jest.mock('uuid', () => ({
  v4: () => require('crypto').randomUUID(),
  v5: () => require('crypto').randomUUID(),
  validate: () => true,
  NIL: '00000000-0000-0000-0000-000000000000',
}));

process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3004';
process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '5432';
process.env.DB_USERNAME ??= 'postgres';
process.env.DB_PASSWORD ??= 'postgres';
process.env.DB_DATABASE ??= 'trackcongo_db';
process.env.INTERNAL_GATEWAY_TOKEN ??= 'test-internal-gateway-token-must-be-32-chars-long';
process.env.RBAC_SERVICE_URL ??= 'http://localhost:3002';

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '../app.module';
import { Vehicle } from '../modules/vehicles/entities/vehicle.entity';
import { VehicleDocument } from '../modules/vehicle-documents/entities/vehicle-document.entity';
import { DeviceRef } from '../modules/vehicles/entities/device.ref.entity';
import { OrganizationRef } from '../modules/vehicles/entities/organization.ref.entity';
import { OrganizationUserRef } from '../modules/vehicles/entities/organization-user.ref.entity';
import { UserRef } from '../modules/vehicles/entities/user.ref.entity';
import { AuditLog } from '../shared/entities/audit-log.entity';
import { OrganizationSettingsRef } from '../shared/org-settings/organization-settings-ref.entity';

describe('AppModule — full DI graph boot', () => {
  let app: TestingModule;

  beforeAll(async () => {
    const stubRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      insert: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
        setLock: jest.fn().mockReturnThis(),
      })),
    };

    const stubDataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => unknown) =>
        cb({
          getRepository: () => stubRepo,
          query: jest.fn().mockResolvedValue([]),
        } as unknown as EntityManager),
      ),
      query: jest.fn().mockResolvedValue([]),
      getRepository: () => stubRepo,
    } as unknown as DataSource;

    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken()).useValue(stubDataSource)
      .overrideProvider(getRepositoryToken(Vehicle)).useValue(stubRepo)
      .overrideProvider(getRepositoryToken(VehicleDocument)).useValue(stubRepo)
      .overrideProvider(getRepositoryToken(DeviceRef)).useValue(stubRepo)
      .overrideProvider(getRepositoryToken(OrganizationRef)).useValue(stubRepo)
      .overrideProvider(getRepositoryToken(OrganizationUserRef)).useValue(stubRepo)
      .overrideProvider(getRepositoryToken(UserRef)).useValue(stubRepo)
      .overrideProvider(getRepositoryToken(AuditLog)).useValue(stubRepo)
      .overrideProvider(getRepositoryToken(OrganizationSettingsRef)).useValue(stubRepo);

    app = await builder.compile();
  }, 60_000);

  afterAll(async () => {
    if (app) {
      try { await app.close(); } catch { /* ignore */ }
    }
  });

  it('compiles the module graph (every injected dependency resolvable)', () => {
    expect(app).toBeDefined();
  });
});
