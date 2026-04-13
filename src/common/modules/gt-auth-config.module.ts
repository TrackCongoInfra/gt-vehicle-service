import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import {
  GtAuthGuard,
  GtPermissionsGuard,
  GtTrustedHeadersMiddleware,
} from '@globaltracking/auth-middleware/nestjs';
import { APP_GUARD } from '@nestjs/core';

interface GtAuthConfigModuleAsyncOptions {
  inject?: any[];
  useFactory: (...args: any[]) => Record<string, any> | Promise<Record<string, any>>;
}

@Module({})
export class GtAuthConfigModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(GtTrustedHeadersMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'internal/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }

  static forRootAsync(options: GtAuthConfigModuleAsyncOptions): DynamicModule {
    return {
      module: GtAuthConfigModule,
      global: true,
      providers: [
        {
          provide: 'GT_AUTH_CONFIG',
          inject: options.inject || [],
          useFactory: options.useFactory,
        },
        {
          provide: APP_GUARD,
          useClass: GtAuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: GtPermissionsGuard,
        },
      ],
      exports: ['GT_AUTH_CONFIG'],
    };
  }
}
