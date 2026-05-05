'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { readOwnerToken } from '@/src/shared/lib/auth-token';
import { formatDate } from '@/src/shared/lib/format/format-date';
import { formatPrice } from '@/src/shared/lib/format/format-price';
import {
  fetchOrder,
  OrderAction,
  resendOrderNotification,
  runOrderAction,
} from '@/src/shared/api/admin-api';
import { Button } from '@/src/shared/ui/button';
import { Input } from '@/src/shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/shared/ui/card';
import { Label } from '@/src/shared/ui/label';
import { Badge } from '@/src/shared/ui/badge';
import { Alert, AlertDescription } from '@/src/shared/ui/alert';

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
      <main className="flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Требуется вход</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="link" className="p-0">
                <ArrowLeft className="mr-2 size-4" />
                Вернуться к логину
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <main className="flex items-center justify-center p-4">
        <Loader2 className="size-6 animate-spin" />
        <span className="ml-2">Загрузка заказа...</span>
      </main>
    );
  }

  if (orderQuery.error) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <Alert variant="destructive">
          <AlertDescription>{orderQuery.error.message}</AlertDescription>
        </Alert>
        <Link href="/">
          <Button variant="link" className="p-0">
            <ArrowLeft className="mr-2 size-4" />
            К списку заказов
          </Button>
        </Link>
      </main>
    );
  }

  const order = orderQuery.data;
  if (!order) {
    return null;
  }

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <Link href="/">
        <Button variant="link" className="p-0">
          <ArrowLeft className="mr-2 size-4" />
          К списку заказов
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Заказ #{order.id}</CardTitle>
            <Badge>{order.status}</Badge>
            <Badge variant="secondary">{order.paymentStatus}</Badge>
            <Badge variant="outline">{order.fulfillmentStatus}</Badge>
            {order.notification.status === 'FAILED' ? (
              <Badge variant="destructive">email failed: {order.notification.event}</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                email: {order.notification.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Гость</h2>
              <div>{order.customerFullName}</div>
              <div className="text-sm text-muted-foreground">{order.customerEmail}</div>
              <div className="text-sm text-muted-foreground">
                {order.customerPhone ?? 'Телефон не указан'}
              </div>
              <div className="text-sm text-muted-foreground">{order.shippingAddress}</div>
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Итоги</h2>
              <div className="text-lg font-medium">{formatPrice(order.totalMinor)}</div>
              <div className="text-sm text-muted-foreground">Создан: {formatDate(order.createdAt)}</div>
              <div className="text-sm text-muted-foreground">Обновлен: {formatDate(order.updatedAt)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Позиции</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <strong className="text-sm">{item.productId}</strong>
                <span className="text-sm text-muted-foreground">{item.quantity} шт.</span>
                <span className="text-sm">{formatPrice(item.totalMinor)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ручные действия</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Комментарий</Label>
            <Input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <form key={action.id} onSubmit={(event) => handleAction(event, action.id)}>
                <Button
                  type="submit"
                  variant={action.id === 'cancel' ? 'destructive' : 'default'}
                  disabled={actionMutation.isPending}
                  size="sm"
                >
                  {action.label}
                </Button>
              </form>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={resendMutation.isPending}
              onClick={() => {
                setMessage(null);
                resendMutation.mutate();
              }}
              size="sm"
            >
              <RefreshCw className="mr-2 size-3" />
              Переотправить уведомление
            </Button>
          </div>
          {message ? (
            <Alert variant={message.includes('Не удалось') ? 'destructive' : 'default'}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История статусов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {order.statusHistory.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-1 border-b pb-3 last:border-0">
                <strong className="text-sm">{entry.statusDimension}</strong>
                <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                <span className="text-sm">
                  {entry.fromStatus ?? entry.fromPaymentStatus ?? entry.fromFulfillmentStatus ?? 'START'}
                  {' -> '}
                  {entry.toStatus ?? entry.toPaymentStatus ?? entry.toFulfillmentStatus}
                </span>
                {entry.changedById ? (
                  <span className="text-xs text-muted-foreground">Владелец: {entry.changedById}</span>
                ) : null}
                {entry.comment ? <span className="text-sm">{entry.comment}</span> : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
