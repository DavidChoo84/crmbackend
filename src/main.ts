import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Enable CORS for your frontend (React app on port 3001)
  app.enableCors({
    origin: [
      'http://localhost:3001', // your React app
      'http://localhost:5173', // optional (Vite)
      'http://localhost:8080', // optional
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  // ✅ Seed admin user if not exists
  const usersService = app.get(UsersService);
  const admin = await usersService.findByUsername('admin');
  if (!admin) {
    console.log('Seeding admin user -> username: admin, password: admin123');
    await usersService.create('admin', 'admin123', undefined, true);
  }

  // ✅ Start server
  await app.listen(3000);
  console.log('🚀 App running on http://localhost:3000');
}

bootstrap();
