import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_DATABASE'),
  ssl: configService.get<boolean>('DB_SSL')
    ? { rejectUnauthorized: false }
    : false,
  logging: configService.get<boolean>('DB_LOGGING'),
  autoLoadEntities: true,
  synchronize: false,
  migrationsRun: false,
  extra: {
    max: configService.get<number>('DB_POOL_MAX') ?? 20,
    idleTimeoutMillis:
      configService.get<number>('DB_POOL_IDLE_TIMEOUT_MS') ?? 30000,
    connectionTimeoutMillis:
      configService.get<number>('DB_POOL_CONNECTION_TIMEOUT_MS') ?? 5000,
  },
});
