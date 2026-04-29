import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedOwner, OwnerJwtPayload } from './auth.types.js';

type OwnerRequest = {
  headers: {
    authorization?: string;
  };
  owner?: AuthenticatedOwner;
};

@Injectable()
export class OwnerAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<OwnerRequest>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_REQUIRED',
        message: 'Требуется Bearer token владельца.',
      });
    }

    const payload = await this.verifyToken(token);
    if (!payload.roles.includes(Role.OWNER)) {
      this.throwOwnerOnly();
    }

    const owner = await this.getCurrentOwner(payload.sub);
    request.owner = {
      id: owner.id,
      email: owner.email,
    };

    return true;
  }

  private extractBearerToken(request: OwnerRequest) {
    const header = request.headers.authorization;
    if (!header) {
      return undefined;
    }

    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : undefined;
  }

  private async verifyToken(token: string) {
    try {
      const payload: unknown = await this.jwtService.verifyAsync(token, {
        secret: this.authService.getJwtSecret(),
      });
      if (!this.isOwnerJwtPayload(payload)) {
        this.throwInvalidToken();
      }

      return payload;
    } catch {
      this.throwInvalidToken();
    }
  }

  private isOwnerJwtPayload(payload: unknown): payload is OwnerJwtPayload {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const candidate = payload as Partial<OwnerJwtPayload>;
    return (
      typeof candidate.sub === 'string' &&
      typeof candidate.email === 'string' &&
      Array.isArray(candidate.roles) &&
      candidate.roles.every((role) => typeof role === 'string')
    );
  }

  private async getCurrentOwner(userId: string) {
    const owner = await this.prisma.user.findFirst({
      where: {
        id: userId,
        roles: {
          some: { role: Role.OWNER },
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!owner) {
      this.throwOwnerOnly();
    }

    return owner;
  }

  private throwOwnerOnly(): never {
    throw new ForbiddenException({
      statusCode: 403,
      code: 'OWNER_ONLY',
      message: 'Операция доступна только владельцу.',
    });
  }

  private throwInvalidToken(): never {
    throw new UnauthorizedException({
      statusCode: 401,
      code: 'AUTH_INVALID_TOKEN',
      message: 'Bearer token недействителен или истек.',
    });
  }
}
