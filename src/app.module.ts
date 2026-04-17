import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GtAuthModule } from '@globaltracking/auth-middleware/nestjs';
import { validationSchema } from './common/config/app.config';
import { getDatabaseConfig } from './common/config/database.config';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { VehicleDocumentsModule } from './modules/vehicle-documents/vehicle-documents.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('RATE_LIMIT_WINDOW_MS') ?? 60000,
            limit: config.get<number>('RATE_LIMIT_MAX') ?? 100,
          },
        ],
      }),
    }),

    // Official auth module — wires middleware + guards + initAuth(config)
    // so the strategy chain is actually active. Previously a custom
    // GtAuthConfigModule provided the config but never called initAuth(),
    // causing every request to fall through to the built-in defaults and
    // fail with "No authentication credentials provided".
    //
    // Both strategies are needed because traffic arrives from two gateways:
    //   - GCP API Gateway (gt-gateway-*.uc.gateway.dev)  → forwards as
    //     `x-apigateway-api-userinfo` header → gateway-header strategy
    //   - Cloud Run gateway (gt-api-gateway-*.run.app)   → forwards trusted
    //     headers (x-user-id, x-org-id, x-gateway-token) → trusted-headers
    // Drop either one and the corresponding callers start getting 500s.
    GtAuthModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        strategies: ['gateway-header', 'trusted-headers'] as const,
        internalGatewayToken: config.get<string>('INTERNAL_GATEWAY_TOKEN'),
        adminRoles: ['system_admin', 'org_admin'],
        rbacServiceUrl: config.get<string>('RBAC_SERVICE_URL'),
      }),
    }),

    VehiclesModule,
    VehicleDocumentsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
