import type {
  EmailMessage,
  OrderEmailEvent,
  OrderEmailSnapshot,
} from './notifications.types.js';

type TemplateContent = {
  subject: string;
  lead: string;
  details: string[];
};

const eventCopy: Record<OrderEmailEvent, TemplateContent> = {
  'order-created': {
    subject: 'Enot Tea: заказ создан',
    lead: 'Мы получили ваш заказ и зарезервировали товары на складе.',
    details: ['Следующий шаг: владелец магазина выставит счёт.'],
  },
  'invoice-issued': {
    subject: 'Enot Tea: счёт выставлен',
    lead: 'Счёт по вашему заказу выставлен.',
    details: ['Пожалуйста, следуйте инструкциям по оплате, полученным от магазина.'],
  },
  'payment-confirmed': {
    subject: 'Enot Tea: оплата подтверждена',
    lead: 'Оплата по вашему заказу подтверждена.',
    details: ['Заказ готовится к передаче в доставку.'],
  },
  'in-delivery': {
    subject: 'Enot Tea: заказ передан в доставку',
    lead: 'Ваш заказ передан в доставку.',
    details: ['Ожидайте получение по указанному адресу доставки.'],
  },
  completed: {
    subject: 'Enot Tea: заказ выполнен',
    lead: 'Доставка вашего заказа подтверждена.',
    details: ['Спасибо, что выбрали Enot Tea.'],
  },
  cancelled: {
    subject: 'Enot Tea: заказ отменён',
    lead: 'Ваш заказ был отменён.',
    details: ['Если отмена произошла ошибочно, свяжитесь с магазином.'],
  },
};

export function buildOrderEmailMessage(
  event: OrderEmailEvent,
  order: OrderEmailSnapshot,
  from: string,
): EmailMessage {
  const content = eventCopy[event];
  const orderIdLine = `Номер заказа: ${order.id}`;
  const totalLine = `Сумма заказа: ${formatMinor(order.totalMinor)}`;
  const text = [
    `Здравствуйте, ${order.customerFullName}!`,
    '',
    content.lead,
    orderIdLine,
    totalLine,
    ...content.details,
  ].join('\n');

  const htmlDetails = content.details
    .map((detail) => `<li>${escapeHtml(detail)}</li>`)
    .join('');

  return {
    to: order.customerEmail,
    from,
    subject: `${content.subject} #${order.id}`,
    text,
    html: [
      '<!doctype html>',
      '<html lang="ru">',
      '<body>',
      `<p>Здравствуйте, ${escapeHtml(order.customerFullName)}!</p>`,
      `<p>${escapeHtml(content.lead)}</p>`,
      `<p><strong>Номер заказа:</strong> ${escapeHtml(order.id)}</p>`,
      `<p><strong>Сумма заказа:</strong> ${escapeHtml(formatMinor(order.totalMinor))}</p>`,
      `<ul>${htmlDetails}</ul>`,
      '</body>',
      '</html>',
    ].join(''),
    tags: {
      orderId: order.id,
      event,
    },
  };
}

function formatMinor(value: number) {
  return `${(value / 100).toFixed(2)} GEL`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
