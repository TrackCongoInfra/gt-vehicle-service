import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_POOL_MAX: Joi.number().default(20),
  DB_POOL_IDLE_TIMEOUT_MS: Joi.number().default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: Joi.number().default(5000),

  // Internal Gateway Auth
  INTERNAL_GATEWAY_TOKEN: Joi.string().min(32).required(),

  // RBAC Service
  RBAC_SERVICE_URL: Joi.string().uri().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX: Joi.number().default(100),

  // CORS
  CORS_ORIGINS: Joi.string().allow('').default(''),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .default('info'),
});
