import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildOrderEmailMessage } from './email-templates.js';
import { getMailerConfig, MailerService } from './mailer.service.js';
import type {
  NotificationAttemptResult,
  OrderEmailEvent,
  OrderEmailSnapshot,
} from './notifications.types.js';

@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
  ) {}

  async sendOrderEvent(
    event: OrderEmailEvent,
    order: OrderEmailSnapshot,
  ): Promise<NotificationAttemptResult> {
    try {
      const message = buildOrderEmailMessage(event, order, getMailerConfig().from);
      await this.mailer.send(message);
      this.logger.log(`Email notification sent orderId=${order.id} event=${event}`);
      return this.recordAttempt(order.id, { event, status: 'SUCCESS' });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(
        `Email notification failed orderId=${order.id} event=${event}: ${errorMessage}`,
      );
      return this.recordAttempt(order.id, { event, status: 'FAILED', errorMessage });
    }
  }

  private async recordAttempt(
    orderId: string,
    result: NotificationAttemptResult,
  ): Promise<NotificationAttemptResult> {
    try {
      const attempt = await this.prisma.notificationAttempt.create({
        data: {
          orderId,
          event: result.event,
          status: result.status,
          ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
        },
        select: {
          event: true,
          status: true,
          errorMessage: true,
          createdAt: true,
        },
      });

      return {
        event: attempt.event as OrderEmailEvent,
        status: attempt.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        ...(attempt.errorMessage ? { errorMessage: attempt.errorMessage } : {}),
        createdAt: attempt.createdAt,
      };
    } catch (error) {
      this.logger.error(
        `Email notification attempt recording failed orderId=${orderId} event=${result.event}: ${getErrorMessage(error)}`,
      );
      return result;
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown email provider error';
}
