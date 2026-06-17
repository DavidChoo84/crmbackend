import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'userId' }); // 🔑 Maps passport 'username' to your 'userId'
  }

  async validate(userId: string, pass: string): Promise<any> {
    const user = await this.authService.validateUser(userId, pass);
    if (!user) {
      throw new UnauthorizedException('Invalid User ID or password');
    }
    return user;
  }
}