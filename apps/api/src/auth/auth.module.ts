import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OwnerAuthGuard } from './owner-auth.guard.js';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, OwnerAuthGuard],
  exports: [AuthService, OwnerAuthGuard, JwtModule],
})
export class AuthModule {}
