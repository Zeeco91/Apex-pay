import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

const MFA_ENFORCED_ROLES: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];

/** Must run after JwtAuthGuard — relies on request.user already being populated. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    const role = request.user.role as UserRole;
    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }

    // Admin trust model hardening (plan §10): manual disbursement and matching move real
    // money, so MFA is mandatory for admin-role accounts on every admin route — not just
    // recommended. A live DB read (rather than trusting the JWT's role claim alone) so this
    // can't be bypassed by an access token issued before MFA was enabled.
    if (MFA_ENFORCED_ROLES.includes(role)) {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: request.user.id },
        select: { mfaEnabled: true },
      });
      if (!user.mfaEnabled) {
        throw new ForbiddenException(
          'Multi-factor authentication must be set up before using admin features. Visit /admin/mfa-setup.',
        );
      }
    }

    return true;
  }
}
