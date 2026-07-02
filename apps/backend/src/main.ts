import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS — mobile clients use Bearer tokens (no Origin header), so '*' without credentials
  // is correct for them. A browser frontend must be named via FRONTEND_URL to allow
  // credentials ('*' + credentials:true is an invalid combo browsers reject).
  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: Boolean(frontendUrl),
  });

  // Swagger (dev only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Rivo API')
      .setDescription('Rivo Beauty Marketplace API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Rivo API running at http://localhost:${port}/api/v1`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
