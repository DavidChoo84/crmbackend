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
  // Local dev origins + any deployed frontend URL(s) from env.
  // FRONTEND_URL can be a comma-separated list, e.g.
  //   https://crm-client.vercel.app,https://crm-preview.vercel.app
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:8080',
    ...(process.env.FRONTEND_URL || '')
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  ];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // ✅ Start backend service
  // Hosting platforms (Render, Railway, Koyeb…) inject PORT; default 3000 locally.
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 App running on port ${port}`);
}

bootstrap();