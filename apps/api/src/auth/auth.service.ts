import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './auth.dto.js';
import type { OwnerJwtPayload } from './auth.types.js';
import { verifyPassword } from './password.js';

const tokenExpiresInSeconds = 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { roles: true },
    });

    const isOwner = user?.roles.some((role) => role.role === Role.OWNER) ?? false;
    const isPasswordValid = user
      ? await verifyPassword(dto.password, user.passwordHash)
      : false;

    if (!user || !isOwner || !isPasswordValid) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Неверный email или пароль владельца.',
      });
    }

    const payload: OwnerJwtPayload = {
      sub: user.id,
      email: user.email,
      roles: [Role.OWNER],
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.getJwtSecret(),
      expiresIn: tokenExpiresInSeconds,
    });

    return {
      accessToken,
      tokenType: 'Bearer' as const,
      expiresIn: tokenExpiresInSeconds,
      ownerId: user.id,
      email: user.email,
    };
  }

  getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is required for owner authentication.');
    }

    return secret;
  }
}
