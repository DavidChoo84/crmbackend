import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config'; // 🟩 Add this for environment variables

// 🟩 Import all modules
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { ProductsModule } from './products/products.module';
import { PackagesModule } from './packages/packages.module';
import { OrdersModule } from './order/order.module';
import { CustomerModule } from './customer/customer.module';

@Module({
  imports: [
    // 🟩 Load .env config globally
    ConfigModule.forRoot({ isGlobal: true }),

    // 🟩 Database connection setup
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'nestuser',
      password: process.env.DB_PASS || 'nestpassword',
      database: process.env.DB_NAME || 'nestjs_db',
      autoLoadEntities: true, // Automatically loads all entities in imported modules
      synchronize: true,      // ⚠️ Enable only in development
    }),

    // 🟩 Register feature modules
    UsersModule,
    AuthModule,
    ProjectsModule,
    ProductsModule,
    PackagesModule,
    OrdersModule,
    CustomerModule
  ],
})
export class AppModule {}
