import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/user.entity';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    MailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'YOUR_SECRET_KEY',
      signOptions: { expiresIn: '1d' }, 
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}