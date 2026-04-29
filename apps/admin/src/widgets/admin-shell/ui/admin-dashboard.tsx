'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { OrderStatus, OrdersControllerListStatus } from '@enot-tea/api-client';
import { clearOwnerToken, readOwnerToken, saveOwnerToken } from '@/src/shared/lib/auth-token';
import { formatDate } from '@/src/shared/lib/format/format-date';
import { formatPrice } from '@/src/shared/lib/format/format-price';
import { fetchOrders, loginOwner } from '@/src/shared/api/admin-api';

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
      <main className="stack">
        <section className="card stack">
          <h1>Enot Tea Admin</h1>
          <p className="muted">Войдите owner-аккаунтом, чтобы управлять заказами.</p>
          <form className="stack" onSubmit={handleLogin}>
            <label className="stack">
              Email владельца
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label className="stack">
              Пароль
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
              />
            </label>
            {authError ? <p className="error">{authError}</p> : null}
            <button type="submit">Войти</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="stack">
      <header className="row">
        <div>
          <h1>Заказы</h1>
          <p className="muted">Owner-only ручной pipeline: счет, оплата, доставка, получение, отмена.</p>
        </div>
        <button type="button" onClick={handleLogout}>
          Выйти
        </button>
      </header>

      <section className="card stack">
        <h2>Фильтры</h2>
        <div className="row">
          <label className="stack">
            Статус
            <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | '')}>
              <option value="">Все</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="stack">
            С даты
            <input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="stack">
            По дату
            <input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </section>

      {ordersQuery.isLoading ? <p>Загрузка заказов...</p> : null}
      {ordersQuery.error ? <p className="error">{ordersQuery.error.message}</p> : null}

      <section className="stack">
        {ordersQuery.data?.items.map((order) => (
          <article className="card stack" key={order.id}>
            <div className="row">
              <strong>#{order.id}</strong>
              <span>{order.status}</span>
              <span>{order.paymentStatus}</span>
              <span>{order.fulfillmentStatus}</span>
            </div>
            <div className="grid grid-two">
              <div>
                <div>{order.customerFullName}</div>
                <div className="muted">{order.customerEmail}</div>
                <div className="muted">{order.customerPhone ?? 'Телефон не указан'}</div>
              </div>
              <div>
                <div>{formatPrice(order.totalMinor)}</div>
                <div className="muted">{order.itemsCount} поз.</div>
                <div className="muted">{formatDate(order.createdAt)}</div>
              </div>
            </div>
            <Link href={`/orders/${order.id}`}>Открыть карточку</Link>
          </article>
        ))}
      </section>

      {ordersQuery.data ? (
        <nav className="row">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>
            Назад
          </button>
          <span className="muted">
            {offset + 1}-{Math.min(offset + ordersQuery.data.items.length, ordersQuery.data.pagination.total)} из{' '}
            {ordersQuery.data.pagination.total}
          </span>
          <button
            type="button"
            disabled={offset + 20 >= ordersQuery.data.pagination.total}
            onClick={() => setOffset(offset + 20)}
          >
            Вперед
          </button>
        </nav>
      ) : null}
    </main>
  );
}
