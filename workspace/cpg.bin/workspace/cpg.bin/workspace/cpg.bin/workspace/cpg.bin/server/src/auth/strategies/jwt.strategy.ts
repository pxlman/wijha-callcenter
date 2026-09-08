import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '@/auth/auth.service';
import type { AuthenticatedUser } from '@/common/interfaces/authenticated-user.interface';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default'),
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: { id: number; email: string; role: string }): Promise<AuthenticatedUser> {
    const authHeader = request.headers.authorization;
    const token = authHeader?.split(' ')[1] ?? '';
    const user = await this.authService.validateUserWithToken(payload.id, token);
    if (!user) {
      throw new UnauthorizedException('Token revoked');
    }
    return { id: user.id, email: user.email, role: user.role };
  }
}
