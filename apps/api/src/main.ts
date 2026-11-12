import 'reflect-metadata';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  // Disable built-in parser so we can raise the limit for avatar base64 uploads (~2 MB → ~2.8 MB JSON).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    bodyParser: false,
  });
  // nginx → web BFF → api (finite hops; never `true` — spoofable X-Forwarded-For).
  app.set('trust proxy', 2);
  app.use(json({ limit: '4mb' }));
  app.use(urlencoded({ extended: true, limit: '4mb' }));

  const config = app.get(ConfigService);

  app.setGlobalPrefix(config.get<string>('API_GLOBAL_PREFIX', 'api'));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const prefix = config.get<string>('API_GLOBAL_PREFIX', 'api');
  const isProd = config.get<string>('NODE_ENV') === 'production';

  // Local storage (dev driver): the browser PUTs/GETs signed URLs on this origin, so allow
  // the web origins on those routes only. R2 handles its own CORS.
  if (config.get<string>('STORAGE_DRIVER', 'local') === 'local') {
    const origins = new Set(
      config
        .get<string>('STORAGE_CORS_ORIGINS', 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    );
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!req.path.startsWith(`/${prefix}/storage/local`)) return next();
      const origin = req.headers.origin;
      if (origin && origins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,HEAD,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Expose-Headers', 'ETag');
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  // Swagger: always outside production; in production only when explicitly enabled, behind basic auth.
  const swaggerEnabled = !isProd || config.get<boolean>('SWAGGER_ENABLED') === true;
  if (swaggerEnabled) {
    if (isProd) {
      const expected = Buffer.from(
        `Basic ${Buffer.from(`${config.get('SWAGGER_USER')}:${config.get('SWAGGER_PASSWORD')}`).toString('base64')}`,
      );
      app.use(`/${prefix}/docs`, (req: Request, res: Response, next: NextFunction) => {
        const given = Buffer.from(req.headers.authorization ?? '');
        if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
        res.setHeader('WWW-Authenticate', 'Basic realm="api-docs"');
        res.status(401).end();
      });
    }
    const swagger = new DocumentBuilder().setTitle('abdcshare API').setVersion('0.1.0').addBearerAuth().build();
    SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swagger));
  }

  const port = config.get<number>('API_PORT', 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api listening on :${port}`);
}
void bootstrap();
