import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity'; // 🔑 Fixed: Removed the .js extension
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // Used by LocalStrategy to check credentials
  // Inside src/auth/auth.service.ts

  async validateUser(userId: string, pass: string): Promise<any> {

    const user = await this.userRepo.findOne({ where: { userId } });
    
    if (!user) {
      console.log(`❌ No user found with userId "${userId}"`);
      return null;
    }
    const isMatch = await bcrypt.compare(pass, user.password);

    if (isMatch) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  // Generates JWT token after successful login
  async login(user: any) {
    const payload = { sub: user.userId, name: user.name, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        userId: user.userId,
        name: user.name,
        role: user.role,
      },
    };
  }

  // Generates a short-lived recovery token for forgot password
  async forgotPassword(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      // Security practice: don't reveal if email doesn't exist
      return { message: 'If this email is registered, a reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 Hour Expiry
    await this.userRepo.save(user);

    // console.log(`Dev Link: http://localhost:5173/reset-password?token=${resetToken}`);
    // TODO: Plug in NodeMailer / SendGrid here to email the link out
    
    return { message: 'If this email is registered, a reset link has been sent.' };
  }
}