import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import type { AccessTokenPayload } from '../token.service';
import type { Env } from '../../../config/env.validation';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    // MFA pending tokens (mfa.service.ts) are signed with this same secret so they can be
    // verified without a second JwtModule registration, but they must NEVER be usable as a
    // real bearer credential — they carry a `purpose` claim that a genuine access token never
    // has, so any token bearing one is rejected here, at the one chokepoint every authenticated
    // request passes through, regardless of which specific route or guard it's aimed at.
    if ('purpose' in payload) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is not active');
    }
    return { id: user.id, phone: user.phone, role: user.role };
  }
}
