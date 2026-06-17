import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'YOUR_JWT_SECRET_KEY', // Best to pull this from configuration (process.env.JWT_SECRET)
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, name: payload.name, role: payload.role };
  }
}