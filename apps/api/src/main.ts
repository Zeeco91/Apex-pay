import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';

const DEV_CORS_ORIGINS = ['http://localhost:3000', /\.trycloudflare\.com$/];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // Default helmet() headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.) are safe for
  // a JSON-only API — this is not an HTML-rendering app, so there's no page-level CSP to tune.
  app.use(helmet());
  app.use(cookieParser());

  // /health stays unversioned — load balancers and uptime monitors expect a stable path.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: corsOrigins
      ? corsOrigins.split(',').map((o) => o.trim())
      : DEV_CORS_ORIGINS,
    credentials: true,
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
}
bootstrap().catch((error: unknown) => {
  Logger.error(
    'Failed to start application',
    error instanceof Error ? error.stack : error,
    'Bootstrap',
  );
  process.exit(1);
});
