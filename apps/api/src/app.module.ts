import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { ProductsController } from './products/products.controller.js';
import { ProductsService } from './products/products.service.js';
import { OrdersController } from './orders/orders.controller.js';
import { OrdersService } from './orders/orders.service.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController, HealthController, ProductsController, OrdersController],
  providers: [AppService, HealthService, ProductsService, OrdersService],
})
export class AppModule {}