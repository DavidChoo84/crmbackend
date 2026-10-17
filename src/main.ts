import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ✅ Global validation pipe for DTO verification
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // ✅ Payload size limits for Base64 assets
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 🔑 FIX: uploaded receipts were being saved to ./uploads on disk, but
  // this folder was never actually served over HTTP — any <img src> or
  // download link pointing at it would 404. This makes it reachable at
  // http://localhost:3000/uploads/<filename>.
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // ✅ Application CORS handling
  app.enableCors({
    origin: [
      'http://localhost:3001', 
      'http://localhost:5173', 
      'http://localhost:8080', 
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // ✅ Start backend service
  await app.listen(3000);
  console.log('🚀 App running on http://localhost:3000');
}

bootstrap();