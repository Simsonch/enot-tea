'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { OrderStatus, OrdersControllerListStatus } from '@enot-tea/api-client';
import { LogOut, Loader2 } from 'lucide-react';
import { clearOwnerToken, readOwnerToken, saveOwnerToken } from '@/src/shared/lib/auth-token';
import { formatDate } from '@/src/shared/lib/format/format-date';
import { formatPrice } from '@/src/shared/lib/format/format-price';
import { fetchOrders, loginOwner } from '@/src/shared/api/admin-api';
import { Button } from '@/src/shared/ui/button';
import { Input } from '@/src/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/shared/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/shared/ui/card';
import { Label } from '@/src/shared/ui/label';
import { Alert, AlertDescription } from '@/src/shared/ui/alert';
import { Badge } from '@/src/shared/ui/badge';

const statuses = Object.values(OrdersControllerListStatus);

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setToken(readOwnerToken());
  }, []);

  useEffect(() => {
    setOffset(0);
  }, [from, status, to]);

  const params = useMemo(
    () => ({
      limit: 20,
      offset,
      ...(status ? { status } : {}),
      ...(from ? { from: toIsoDateTime(from) } : {}),
      ...(to ? { to: toIsoDateTime(to) } : {}),
    }),
    [from, offset, status, to],
  );

  const ordersQuery = useQuery({
    queryKey: ['orders', token, params],
    queryFn: () => fetchOrders(token ?? '', params),
    enabled: Boolean(token),
  });

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);

    try {
      const result = await loginOwner({ email, password });
      saveOwnerToken(result.accessToken);
      setToken(result.accessToken);
      setPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Не удалось войти.');
    }
  }

  function handleLogout() {
    clearOwnerToken();
    setToken(null);
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Enot Tea Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Войдите owner-аккаунтом, чтобы управлять заказами.
            </p>
            <form className="flex flex-col gap-4" onSubmit={handleLogin}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email владельца</Label>
                <Input
                  id="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  required
                />
              </div>
              {authError ? (
                <Alert variant="destructive">
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full">
                Войти
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Заказы</h1>
          <p className="text-sm text-muted-foreground">
            Owner-only ручной pipeline: счет, оплата, доставка, получение, отмена.
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="mr-2 size-4" />
          Выйти
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Статус</Label>
              <Select
                value={status || 'all'}
                onValueChange={(value) => setStatus(value === 'all' ? '' : value as OrderStatus)}
              >
                <SelectTrigger id="status" className="w-[180px]">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {statuses.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="from">С даты</Label>
              <Input
                id="from"
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="to">По дату</Label>
              <Input
                id="to"
                type="datetime-local"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {ordersQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin" />
          <span className="ml-2">Загрузка заказов...</span>
        </div>
      ) : null}
      {ordersQuery.error ? (
        <Alert variant="destructive">
          <AlertDescription>{ordersQuery.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        {ordersQuery.data?.items.map((order) => (
          <Card key={order.id}>
            <CardContent className="pt-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <strong className="text-lg">#{order.id}</strong>
                <Badge>{order.status}</Badge>
                <Badge variant="secondary">{order.paymentStatus}</Badge>
                <Badge variant="outline">{order.fulfillmentStatus}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="font-medium">{order.customerFullName}</div>
                  <div className="text-sm text-muted-foreground">{order.customerEmail}</div>
                  <div className="text-sm text-muted-foreground">
                    {order.customerPhone ?? 'Телефон не указан'}
                  </div>
                </div>
                <div>
                  <div className="font-medium">{formatPrice(order.totalMinor)}</div>
                  <div className="text-sm text-muted-foreground">{order.itemsCount} поз.</div>
                  <div className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</div>
                </div>
              </div>
              <Link href={`/orders/${order.id}`} className="mt-4 inline-block">
                <Button variant="link" className="p-0">
                  Открыть карточку
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {ordersQuery.data ? (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            {offset + 1}-{Math.min(offset + ordersQuery.data.items.length, ordersQuery.data.pagination.total)} из{' '}
            {ordersQuery.data.pagination.total}
          </span>
          <Button
            variant="outline"
            disabled={offset + 20 >= ordersQuery.data.pagination.total}
            onClick={() => setOffset(offset + 20)}
          >
            Вперед
          </Button>
        </div>
      ) : null}
    </main>
  );
}
