export type EmailProviderName = 'log' | 'resend';

export type OrderEmailEvent =
  | 'order-created'
  | 'invoice-issued'
  | 'payment-confirmed'
  | 'in-delivery'
  | 'completed'
  | 'cancelled';

export type EmailMessage = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  tags: {
    orderId: string;
    event: OrderEmailEvent;
  };
};

export type OrderEmailSnapshot = {
  id: string;
  customerEmail: string;
  customerFullName: string;
  totalMinor: number;
};

export type NotificationAttemptResult = {
  event: OrderEmailEvent;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  createdAt?: Date;
};
