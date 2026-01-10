process.env.TZ = 'UTC';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { CustomLoggerService } from './utils/custom-logger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as pkg from '../package.json';
import { ValidationPipe } from '@nestjs/common';
import { Environments } from 'env-configs';
import { json, urlencoded } from 'express';
import { useContainer } from 'class-validator';
import { setGlobalModuleRef } from './utils/validators/validator.utils';
import { ModuleRef } from '@nestjs/core';

async function bootstrap() {
  const envConfigVariables = Object.keys(Environments);
  const missingEnvVariables = envConfigVariables.filter(
    (key) =>
      Environments[key] === undefined || Environments[key] === null || Environments[key] === '',
  );

  if (missingEnvVariables.length > 0) {
    throw new Error(
      `❌ Missing required environment variables: [${missingEnvVariables.join(', ')}]`,
    );
  }

  const app = await NestFactory.create(AppModule);
  const appPort = Environments.APP_PORT || 3333;
  const globalPrefix = 'api/v1';
  const customLogger = new CustomLoggerService();
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix(globalPrefix);

  app.enableCors();

  const moduleRef = app.get(ModuleRef);
  setGlobalModuleRef(moduleRef);

  if (Environments.APP_ENVIRONMENT !== 'production') {
    const docBuilder = new DocumentBuilder()
      .setTitle(`${pkg.name} APIs`)
      .setDescription(`${pkg.name} Backend APIs`)
      .setVersion(`${pkg.version}`)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth');

    const config = docBuilder.build();
    const document = SwaggerModule.createDocument(app, config);

    // Apply JWT security globally
    document.security = [{ 'JWT-auth': [] }];

    // Add required headers as global parameters (more reliable than apiKey security)
    if (Environments.ENFORCE_REQUIRED_HEADERS) {
      const globalHeaders = [
        {
          name: 'X-Active-Role',
          in: 'header' as const,
          required: true,
          schema: { type: 'string', example: 'ADMIN' },
          description: 'Active role (ADMIN, HR, EMPLOYEE, DRIVER)',
        },
        {
          name: 'X-Correlation-Id',
          in: 'header' as const,
          required: true,
          schema: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          description: 'Correlation ID (UUID for request tracing)',
        },
        {
          name: 'X-Source-Type',
          in: 'header' as const,
          required: true,
          schema: { type: 'string', example: 'web' },
          description: 'Source type (web/mobile)',
        },
        {
          name: 'X-Client-Type',
          in: 'header' as const,
          required: true,
          schema: { type: 'string', example: 'web' },
          description: 'Client type (web/mobile/desktop)',
        },
        {
          name: 'X-Timezone',
          in: 'header' as const,
          required: true,
          schema: { type: 'string', example: 'Asia/Kolkata' },
          description: 'User timezone (IANA timezone format, e.g., Asia/Kolkata, America/New_York)',
        },
      ];

      // Add headers to all paths/operations
      Object.values(document.paths).forEach((pathItem: any) => {
        ['get', 'post', 'put', 'patch', 'delete'].forEach((method) => {
          if (pathItem[method]) {
            pathItem[method].parameters = [
              ...(pathItem[method].parameters || []),
              ...globalHeaders,
            ];
          }
        });
      });
    }

    SwaggerModule.setup('api/v1', app, document);
  }

  await app.listen(appPort, () => {
    customLogger.log(`Listening at http://localhost:${appPort}/${globalPrefix}`);
  });
}
bootstrap();
