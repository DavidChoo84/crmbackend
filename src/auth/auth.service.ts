import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

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

  async login(user: any) {
    const payload = { userId: user.userId, name: user.name, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        userId: user.userId,
        name: user.name,
        role: user.role,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      return { message: 'If this email is registered, a reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 Hour Expiry
    await this.userRepo.save(user);

    await this.mailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If this email is registered, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userRepo.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Reset token is invalid or has expired.');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.userRepo.save(user);

    return { message: 'Password has been reset successfully.' };
  }
}