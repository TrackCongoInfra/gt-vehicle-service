import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, text, urlencoded } from 'express';
import { AppModule } from './app.module';
import { GcpLoggerService } from './common/helpers/gcp-logger.service';

async function bootstrap() {
  const logger = new GcpLoggerService();
  const app = await NestFactory.create(AppModule, { logger });

  // Graceful shutdown — drain connections on SIGTERM/SIGINT
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Security
  app.use(helmet());

  // Request body size limits
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  // CSV bulk-upload bodies — parsed as raw text. 5mb covers ~500 vehicles.
  app.use(text({ type: ['text/csv', 'application/csv'], limit: '5mb' }));

  // CORS — allow all origins in dev, restrict in production via CORS_ORIGINS
  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  app.enableCors({
    origin: corsOrigins
      ? corsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
      : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Content-Type,Authorization,X-Gateway-Token,X-Apigateway-Api-Userinfo',
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger (only in development)
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Global Tracking - Vehicle Service')
      .setDescription(
        'Vehicle onboarding and lifecycle management microservice for the Global Tracking platform. ' +
          'Manages vehicle CRUD, document management, and asset registry. ' +
          'Multi-org isolated via org_id. Accepts trusted headers from API Gateway.\n\n' +
          '**v1.1.0 changes**: GET response field `companyName` has been renamed to `orgName` ' +
          '(sourced from `public.organizations.org_name`). Clients consuming the old field must migrate.',
      )
      .setVersion('1.1.0')
      .addApiKey(
        { type: 'apiKey', in: 'header', name: 'X-Gateway-Token' },
        'GatewayToken',
      )
      .addServer(`http://localhost:${configService.get<number>('PORT')}`, 'Local Development')
      .addTag('Health', 'Health check endpoints')
      .addTag('Vehicles', 'Vehicle CRUD operations')
      .addTag('Vehicle Documents', 'Vehicle document management')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT') ?? 3001;
  await app.listen(port);

  logger.log(`gt-vehicle-service running on http://localhost:${port}`);
  if (configService.get<string>('NODE_ENV') !== 'production') {
    logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
