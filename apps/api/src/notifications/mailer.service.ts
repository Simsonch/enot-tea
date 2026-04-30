import { Injectable, Logger } from '@nestjs/common';
import type { EmailMessage, EmailProviderName } from './notifications.types.js';

type MailerConfig = {
  provider: EmailProviderName;
  from: string;
  requestTimeoutMs: number;
  resendApiKey?: string;
};

const DEFAULT_EMAIL_FROM = 'Enot Tea <no-reply@example.com>';
const DEFAULT_EMAIL_REQUEST_TIMEOUT_MS = 5000;

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async send(message: EmailMessage): Promise<void> {
    const config = getMailerConfig();
    const messageWithConfiguredFrom = {
      ...message,
      from: config.from,
    };

    if (config.provider === 'log') {
      this.logger.log(
        `Email notification prepared provider=log orderId=${message.tags.orderId} event=${message.tags.event}`,
      );
      return;
    }

    await this.sendViaResend(messageWithConfiguredFrom, config);
  }

  private async sendViaResend(message: EmailMessage, config: MailerConfig) {
    if (!config.resendApiKey) {
      throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          tags: [
            { name: 'orderId', value: message.tags.orderId },
            { name: 'event', value: message.tags.event },
          ],
        }),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(
          `Resend email request timed out after ${config.requestTimeoutMs}ms.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Resend email request failed with status=${response.status}.`);
    }
  }
}

export function getMailerConfig(env: NodeJS.ProcessEnv = process.env): MailerConfig {
  const provider = parseProvider(env.EMAIL_PROVIDER);
  const from = env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
  const requestTimeoutMs = parseRequestTimeoutMs(env.EMAIL_REQUEST_TIMEOUT_MS);
  const resendApiKey = env.RESEND_API_KEY?.trim();

  return {
    provider,
    from,
    requestTimeoutMs,
    ...(resendApiKey ? { resendApiKey } : {}),
  };
}

function parseProvider(value: string | undefined): EmailProviderName {
  if (!value) {
    return 'log';
  }

  if (value === 'log' || value === 'resend') {
    return value;
  }

  throw new Error(`Unsupported EMAIL_PROVIDER=${value}. Use "log" or "resend".`);
}

function parseRequestTimeoutMs(value: string | undefined) {
  if (!value) {
    return DEFAULT_EMAIL_REQUEST_TIMEOUT_MS;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('EMAIL_REQUEST_TIMEOUT_MS must be a positive integer.');
  }

  return parsed;
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}
