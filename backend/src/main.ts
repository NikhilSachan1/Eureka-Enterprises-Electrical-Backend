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
  const globalPrefix = 'api';
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
    const config = new DocumentBuilder()
      .setTitle(`${pkg.name} APIs`)
      .setDescription(`${pkg.name} Backend APIs`)
      .setVersion(`${pkg.version}`)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(appPort, () => {
    customLogger.log(`Listening at http://localhost:${appPort}/${globalPrefix}`);
  });
}
bootstrap();
