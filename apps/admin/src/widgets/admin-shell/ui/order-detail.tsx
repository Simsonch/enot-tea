'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readOwnerToken } from '@/src/shared/lib/auth-token';
import { formatDate } from '@/src/shared/lib/format/format-date';
import { formatPrice } from '@/src/shared/lib/format/format-price';
import {
  fetchOrder,
  OrderAction,
  resendOrderNotification,
  runOrderAction,
} from '@/src/shared/api/admin-api';

const actions: Array<{ id: OrderAction; label: string }> = [
  { id: 'invoice-sent', label: 'Счет выставлен' },
  { id: 'payment-confirmed', label: 'Оплата подтверждена' },
  { id: 'handoff-to-delivery', label: 'Передано в доставку' },
  { id: 'delivered', label: 'Получение подтверждено' },
  { id: 'cancel', label: 'Отменить заказ' },
];

export function OrderDetail({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setToken(readOwnerToken());
  }, []);

  const orderQuery = useQuery({
    queryKey: ['order', orderId, token],
    queryFn: () => fetchOrder(token ?? '', orderId),
    enabled: Boolean(token),
  });

  const actionMutation = useMutation({
    mutationFn: (action: OrderAction) =>
      runOrderAction(token ?? '', orderId, action, comment ? { comment } : {}),
    onSuccess: async () => {
      setComment('');
      setMessage('Действие выполнено.');
      await queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Не удалось выполнить действие.');
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => resendOrderNotification(token ?? '', orderId),
    onSuccess: async () => {
      setMessage('Уведомление переотправлено.');
      await queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Не удалось переотправить уведомление.');
    },
  });

  function handleAction(event: FormEvent<HTMLFormElement>, action: OrderAction) {
    event.preventDefault();
    setMessage(null);
    actionMutation.mutate(action);
  }

  if (!token) {
    return (
      <main className="stack">
        <section className="card stack">
          <h1>Требуется вход</h1>
          <Link href="/">Вернуться к логину</Link>
        </section>
      </main>
    );
  }

  if (orderQuery.isLoading) {
    return <main>Загрузка заказа...</main>;
  }

  if (orderQuery.error) {
    return (
      <main className="stack">
        <p className="error">{orderQuery.error.message}</p>
        <Link href="/">К списку заказов</Link>
      </main>
    );
  }

  const order = orderQuery.data;
  if (!order) {
    return null;
  }

  return (
    <main className="stack">
      <Link href="/">К списку заказов</Link>
      <section className="card stack">
        <div className="row">
          <h1>Заказ #{order.id}</h1>
          <span>{order.status}</span>
          <span>{order.paymentStatus}</span>
          <span>{order.fulfillmentStatus}</span>
          {order.notification.status === 'FAILED' ? (
            <span className="error">email failed: {order.notification.event}</span>
          ) : (
            <span className="muted">email: {order.notification.status}</span>
          )}
        </div>
        <div className="grid grid-two">
          <div className="stack">
            <h2>Гость</h2>
            <div>{order.customerFullName}</div>
            <div>{order.customerEmail}</div>
            <div>{order.customerPhone ?? 'Телефон не указан'}</div>
            <div>{order.shippingAddress}</div>
          </div>
          <div className="stack">
            <h2>Итоги</h2>
            <div>{formatPrice(order.totalMinor)}</div>
            <div>Создан: {formatDate(order.createdAt)}</div>
            <div>Обновлен: {formatDate(order.updatedAt)}</div>
          </div>
        </div>
      </section>

      <section className="card stack">
        <h2>Позиции</h2>
        {order.items.map((item) => (
          <div className="row" key={item.id}>
            <strong>{item.productId}</strong>
            <span>{item.quantity} шт.</span>
            <span>{formatPrice(item.totalMinor)}</span>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2>Ручные действия</h2>
        <label className="stack">
          Комментарий
          <input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} />
        </label>
        <div className="row">
          {actions.map((action) => (
            <form key={action.id} onSubmit={(event) => handleAction(event, action.id)}>
              <button type="submit" disabled={actionMutation.isPending}>
                {action.label}
              </button>
            </form>
          ))}
          <button
            type="button"
            disabled={resendMutation.isPending}
            onClick={() => {
              setMessage(null);
              resendMutation.mutate();
            }}
          >
            Переотправить уведомление
          </button>
        </div>
        {message ? (
          <p className={message.includes('Не удалось') ? 'error' : 'success'}>{message}</p>
        ) : null}
      </section>

      <section className="card stack">
        <h2>История статусов</h2>
        {order.statusHistory.map((entry) => (
          <article className="stack" key={entry.id}>
            <strong>{entry.statusDimension}</strong>
            <span className="muted">{formatDate(entry.createdAt)}</span>
            <span>
              {entry.fromStatus ?? entry.fromPaymentStatus ?? entry.fromFulfillmentStatus ?? 'START'}
              {' -> '}
              {entry.toStatus ?? entry.toPaymentStatus ?? entry.toFulfillmentStatus}
            </span>
            {entry.changedById ? <span>Владелец: {entry.changedById}</span> : null}
            {entry.comment ? <span>{entry.comment}</span> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
